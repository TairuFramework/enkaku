import type {
  AnyServerPayloadOf,
  ChannelPayloadOf,
  ClientMessage,
  ProtocolDefinition,
} from '@enkaku/protocol'
import { createPipe, tap, writeTo } from '@enkaku/stream'

import type {
  ChannelController,
  ChannelHandler,
  HandlerContext,
  ReceiveType,
  SendType,
} from '../types.js'
import { executeHandler } from '../utils.js'

export type ChannelMessageOf<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<ChannelPayloadOf<Procedure, Protocol[Procedure]>>

export function handleChannel<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: ChannelMessageOf<Protocol, Procedure>,
): Error | Promise<void> {
  const handler = ctx.handlers[msg.payload.prc] as unknown as ChannelHandler<Protocol, Procedure>
  if (handler == null) {
    return new Error(`No handler for procedure: ${msg.payload.prc}`)
  }

  ctx.logger.trace('handle channel {procedure} with ID {rid}', {
    procedure: msg.payload.prc,
    rid: msg.payload.rid,
  })

  const sendStream = createPipe<SendType<Protocol, Procedure>>()
  const controller: ChannelController<SendType<Protocol, Procedure>> = Object.assign(
    new AbortController(),
    { writer: sendStream.writable.getWriter() },
  )
  controller.signal.addEventListener('abort', () => {
    controller.writer.close()
  })
  ctx.controllers[msg.payload.rid] = controller

  const receiveStream = createPipe<ReceiveType<Protocol, Procedure>>()
  receiveStream.readable.pipeTo(
    writeTo<ReceiveType<Protocol, Procedure>>(async (val) => {
      if (controller.signal.aborted) {
        return
      }
      ctx.logger.trace('send value to channel {procedure} with ID {rid}', {
        procedure: msg.payload.prc,
        rid: msg.payload.rid,
      })
      await ctx.send({
        typ: 'receive',
        rid: msg.payload.rid,
        val,
      } as unknown as AnyServerPayloadOf<Protocol>)
    }),
  )

  const readable = sendStream.readable.pipeThrough(
    tap((value) => {
      ctx.logger.trace('received value from channel {procedure} with ID {rid}', {
        procedure: msg.payload.prc,
        rid: msg.payload.rid,
        value,
      })
    }),
  )

  const handlerContext = {
    message: msg,
    param: msg.payload.prm,
    readable,
    signal: controller.signal,
    writable: receiveStream.writable,
  }

  // Wrap execution to ensure stream cleanup on handler crash
  return (async () => {
    try {
      // @ts-expect-error context and handler types
      await executeHandler(ctx, msg.payload, () => handler(handlerContext))
    } finally {
      try {
        await receiveStream.writable.close()
      } catch {
        // Stream may already be closed
      }
    }
  })()
}
