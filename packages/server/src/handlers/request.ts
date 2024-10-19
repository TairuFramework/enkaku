import type { AnyDefinitions, ClientMessage, RequestPayloadOf } from '@enkaku/protocol'

import { ErrorRejection } from '../rejections.js'
import type {
  HandlerContext,
  ParamsType,
  RequestHandler,
  RequestHandlerContext,
  ResultType,
} from '../types.js'
import { executeHandler } from '../utils.js'

export type RequestMessageOf<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<RequestPayloadOf<Command, Definitions[Command]>>

export function handleRequest<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
>(
  ctx: HandlerContext<Definitions>,
  msg: RequestMessageOf<Definitions, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as RequestHandler<
    Command,
    ParamsType<Definitions, Command>,
    ResultType<Definitions, Command>
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const controller = new AbortController()
  ctx.controllers[msg.payload.rid] = controller

  const handlerContext = {
    params: msg.payload.prm,
    signal: controller.signal,
  } as unknown as RequestHandlerContext<'request', Command, ParamsType<Definitions, Command>>
  return executeHandler(ctx, msg.payload, () => handler(handlerContext))
}
