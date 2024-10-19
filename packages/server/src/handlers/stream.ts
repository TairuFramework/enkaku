import type {
  AnyDefinitions,
  AnyServerPayloadOf,
  ClientMessage,
  StreamPayloadOf,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'

import { ErrorRejection } from '../rejections.js'
import type {
  HandlerContext,
  ParamsType,
  ReceiveType,
  ResultType,
  StreamHandler,
  StreamHandlerContext,
} from '../types.js'
import { consumeReader, executeHandler } from '../utils.js'

export type StreamMessageOf<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<StreamPayloadOf<Command, Definitions[Command]>>

export function handleStream<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
>(
  ctx: HandlerContext<Definitions>,
  msg: StreamMessageOf<Definitions, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as StreamHandler<
    Command,
    ParamsType<Definitions, Command>,
    ReceiveType<Definitions, Command>,
    ResultType<Definitions, Command>
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const controller = new AbortController()
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
    params: msg.payload.prm,
    signal: controller.signal,
    writable: receiveStream.writable,
  } as unknown as StreamHandlerContext<
    'stream',
    Command,
    ParamsType<Definitions, Command>,
    ReceiveType<Definitions, Command>
  >
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
