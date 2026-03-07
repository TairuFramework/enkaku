import { AttributeKeys, getActiveSpan } from '@enkaku/otel'
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

  const param = msg.payload.prm
  if (param == null) {
    ctx.logger.trace('handle channel {procedure} with ID {rid}', {
      procedure: msg.payload.prc,
      rid: msg.payload.rid,
    })
  } else {
    ctx.logger.trace('handle channel {procedure} with ID {rid} and param: {param}', {
      procedure: msg.payload.prc,
      rid: msg.payload.rid,
      param,
    })
  }

  const activeSpan = getActiveSpan()

  const sendStream = createPipe<SendType<Protocol, Procedure>>()
  const issuer = (msg.payload as Record<string, unknown>).iss as string | undefined
  const controller: ChannelController<SendType<Protocol, Procedure>> = Object.assign(
    new AbortController(),
    { issuer, writer: sendStream.writable.getWriter() },
  )
  controller.signal.addEventListener('abort', () => {
    controller.writer.close()
  })
  ctx.controllers[msg.payload.rid] = controller

  const receiveStream = createPipe<ReceiveType<Protocol, Procedure>>()
  const pipePromise = receiveStream.readable.pipeTo(
    writeTo<ReceiveType<Protocol, Procedure>>(async (val) => {
      if (controller.signal.aborted) {
        return
      }
      if (activeSpan != null) {
        activeSpan.addEvent('channel.message.sent', {
          [AttributeKeys.MESSAGE_DIRECTION]: 'send',
        })
      }
      ctx.logger.trace('send value to channel {procedure} with ID {rid}: {val}', {
        procedure: msg.payload.prc,
        rid: msg.payload.rid,
        val,
      })
      await ctx.send({
        typ: 'receive',
        rid: msg.payload.rid,
        val,
      } as unknown as AnyServerPayloadOf<Protocol>)
    }),
  )

  // @ts-expect-error type instantiation too deep
  const readable = sendStream.readable.pipeThrough(
    tap((value) => {
      if (activeSpan != null) {
        activeSpan.addEvent('channel.message.received', {
          [AttributeKeys.MESSAGE_DIRECTION]: 'receive',
        })
      }
      ctx.logger.trace('received value from channel {procedure} with ID {rid}: {value}', {
        procedure: msg.payload.prc,
        rid: msg.payload.rid,
        value,
      })
    }),
  )

  const handlerContext = {
    message: msg,
    param,
    readable,
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
