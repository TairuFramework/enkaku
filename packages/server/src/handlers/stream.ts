import { AttributeKeys, getActiveSpan } from '@enkaku/otel'
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

  const param = msg.payload.prm
  if (param == null) {
    ctx.logger.trace('handle stream {procedure} with ID {rid}', {
      procedure: msg.payload.prc,
      rid: msg.payload.rid,
    })
  } else {
    ctx.logger.trace('handle stream {procedure} with ID {rid} and param: {param}', {
      procedure: msg.payload.prc,
      rid: msg.payload.rid,
      param,
    })
  }

  const activeSpan = getActiveSpan()

  const controller = new AbortController()
  ctx.controllers[msg.payload.rid] = controller

  const receiveStream = createPipe<ReceiveType<Protocol, Procedure>>()
  const pipePromise = receiveStream.readable.pipeTo(
    writeTo<ReceiveType<Protocol, Procedure>>(async (val) => {
      if (controller.signal.aborted) {
        return
      }
      if (activeSpan != null) {
        activeSpan.addEvent('stream.message.sent', {
          [AttributeKeys.MESSAGE_DIRECTION]: 'send',
        })
      }
      ctx.logger.trace('send value to stream {procedure} with ID {rid}: {val}', {
        procedure: msg.payload.prc,
        rid: msg.payload.rid,
        val,
      })
      await ctx.send(
        {
          typ: 'receive',
          rid: msg.payload.rid,
          val,
        } as unknown as AnyServerPayloadOf<Protocol>,
        { rid: msg.payload.rid },
      )
    }),
  )

  const handlerContext = {
    message: msg,
    param: msg.payload.prm,
    signal: controller.signal,
    writable: receiveStream.writable,
  }

  return executeHandler({
    context: ctx,
    payload: msg.payload,
    // @ts-expect-error handler context types
    execute: () => handler(handlerContext),
    beforeEnd: () => receiveStream.drain(pipePromise),
  })
}
