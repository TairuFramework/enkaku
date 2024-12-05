import type {
  AnyServerPayloadOf,
  ChannelPayloadOf,
  ClientMessage,
  ProtocolDefinition,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'

import { ErrorRejection } from '../rejections.js'
import type {
  ChannelController,
  ChannelHandler,
  HandlerContext,
  ReceiveType,
  SendType,
} from '../types.js'
import { consumeReader, executeHandler } from '../utils.js'

export type ChannelMessageOf<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<ChannelPayloadOf<Command, Protocol[Command]>>

export function handleChannel<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: ChannelMessageOf<Protocol, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as unknown as ChannelHandler<Protocol, Command>
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const sendStream = createPipe<SendType<Protocol, Command>>()
  const controller: ChannelController<SendType<Protocol, Command>> = Object.assign(
    new AbortController(),
    { writer: sendStream.writable.getWriter() },
  )
  controller.signal.addEventListener('abort', () => {
    controller.writer.close()
  })
  ctx.controllers[msg.payload.rid] = controller

  const receiveStream = createPipe<ReceiveType<Protocol, Command>>()
  // @ts-ignore type instantiation too deep
  consumeReader({
    // @ts-ignore type instantiation too deep
    onValue: async (val) => {
      await ctx.send({
        typ: 'receive',
        rid: msg.payload.rid,
        val,
      } as unknown as AnyServerPayloadOf<Protocol>)
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
  }
  // @ts-ignore context and handler types
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
