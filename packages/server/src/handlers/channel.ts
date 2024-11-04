import type {
  AnyDefinitions,
  AnyServerPayloadOf,
  ChannelPayloadOf,
  ClientMessage,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'

import { ErrorRejection } from '../rejections.js'
import type {
  ChannelController,
  ChannelHandler,
  ChannelHandlerContext,
  HandlerContext,
  ParamsType,
  ReceiveType,
  ResultType,
  SendType,
} from '../types.js'
import { consumeReader, executeHandler } from '../utils.js'

export type ChannelMessageOf<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<ChannelPayloadOf<Command, Definitions[Command]>>

export function handleChannel<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
>(
  ctx: HandlerContext<Definitions>,
  msg: ChannelMessageOf<Definitions, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as ChannelHandler<
    Command,
    ParamsType<Definitions, Command>,
    SendType<Definitions, Command>,
    ReceiveType<Definitions, Command>,
    ResultType<Definitions, Command>
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const sendStream = createPipe<SendType<Definitions, Command>>()
  const controller: ChannelController<SendType<Definitions, Command>> = Object.assign(
    new AbortController(),
    { writer: sendStream.writable.getWriter() },
  )
  controller.signal.addEventListener('abort', () => {
    controller.writer.close()
  })
  ctx.controllers[msg.payload.rid] = controller

  const receiveStream = createPipe<ReceiveType<Definitions, Command>>()
  consumeReader({
    onValue: async (val) => {
      await ctx.send({
        typ: 'receive',
        rid: msg.payload.rid,
        val,
      } as AnyServerPayloadOf<Definitions>)
    },
    reader: receiveStream.readable.getReader(),
    signal: controller.signal,
  })

  const handlerContext = {
    message: msg,
    params: msg.payload.prm,
    readable: sendStream.readable,
    signal: controller.signal,
    writable: receiveStream.writable,
  } as unknown as ChannelHandlerContext<
    Command,
    ParamsType<Definitions, Command>,
    SendType<Definitions, Command>,
    ReceiveType<Definitions, Command>
  >
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
