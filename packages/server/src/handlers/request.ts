import type { ClientMessage, ProtocolDefinition, RequestPayloadOf } from '@enkaku/protocol'

import type { HandlerContext, RequestHandler } from '../types.js'
import { executeHandler } from '../utils.js'

export type RequestMessageOf<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<RequestPayloadOf<Procedure, Protocol[Procedure]>>

export function handleRequest<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: RequestMessageOf<Protocol, Procedure>,
): Error | Promise<void> {
  const handler = ctx.handlers[msg.payload.prc] as unknown as RequestHandler<Protocol, Procedure>
  if (handler == null) {
    return new Error(`No handler for procedure: ${msg.payload.prc}`)
  }

  ctx.logger.trace('handle request {procedure} with ID {rid}', {
    procedure: msg.payload.prc,
    rid: msg.payload.rid,
    param: msg.payload.prm,
  })

  const controller = new AbortController()
  ctx.controllers[msg.payload.rid] = controller

  const handlerContext = {
    message: msg,
    param: msg.payload.prm,
    signal: controller.signal,
  }
  // @ts-expect-error context and handler types
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
