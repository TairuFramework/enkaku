import type { ClientMessage, ProtocolDefinition, RequestPayloadOf } from '@enkaku/protocol'

import { ErrorRejection } from '../rejections.js'
import type { HandlerContext, RequestHandler } from '../types.js'
import { executeHandler } from '../utils.js'

export type RequestMessageOf<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<RequestPayloadOf<Command, Protocol[Command]>>

export function handleRequest<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: RequestMessageOf<Protocol, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as unknown as RequestHandler<Protocol, Command>
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const controller = new AbortController()
  ctx.controllers[msg.payload.rid] = controller

  const handlerContext = {
    message: msg,
    params: msg.payload.prm,
    signal: controller.signal,
  }
  // @ts-ignore context and handler types
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
