import type {
  AnyServerPayloadOf,
  ClientMessage,
  ProtocolDefinition,
  StreamPayloadOf,
} from '@enkaku/protocol'
import { createPipe, writeTo } from '@enkaku/stream'

import type { HandlerContext, ReceiveType, StreamHandler } from '../types.js'
import { executeHandler } from '../utils.js'

export type StreamMessageOf<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<StreamPayloadOf<Procedure, Protocol[Procedure]>>

export function handleStream<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(ctx: HandlerContext<Protocol>, msg: StreamMessageOf<Protocol, Procedure>): Error | Promise<void> {
  const handler = ctx.handlers[msg.payload.prc] as unknown as StreamHandler<Protocol, Procedure>
  if (handler == null) {
    return new Error(`No handler for procedure: ${msg.payload.prc}`)
  }

  const controller = new AbortController()
  ctx.controllers[msg.payload.rid] = controller

  const receiveStream = createPipe<ReceiveType<Protocol, Procedure>>()
  receiveStream.readable.pipeTo(
    writeTo<ReceiveType<Protocol, Procedure>>(async (val) => {
      if (controller.signal.aborted) {
        return
      }
      await ctx.send({
        typ: 'receive',
        rid: msg.payload.rid,
        val,
      } as unknown as AnyServerPayloadOf<Protocol>)
    }),
  )

  const handlerContext = {
    message: msg,
    param: msg.payload.prm,
    signal: controller.signal,
    writable: receiveStream.writable,
  }
  // @ts-ignore context and handler types
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
