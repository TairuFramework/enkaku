import type {
  AnyServerPayloadOf,
  ClientMessage,
  ProtocolDefinition,
  StreamPayloadOf,
} from '@enkaku/protocol'
import { createPipe } from '@enkaku/stream'

import { ErrorRejection } from '../rejections.js'
import type { HandlerContext, ReceiveType, StreamHandler } from '../types.js'
import { consumeReader, executeHandler } from '../utils.js'

export type StreamMessageOf<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<StreamPayloadOf<Command, Protocol[Command]>>

export function handleStream<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: StreamMessageOf<Protocol, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as unknown as StreamHandler<Protocol, Command>
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const controller = new AbortController()
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
    signal: controller.signal,
    writable: receiveStream.writable,
  }
  // @ts-ignore context and handler types
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
