import type {
  AnyActionDefinitions,
  ClientMessage,
  OptionalRecord,
  RequestActionPayloadOf,
} from '@enkaku/protocol'

import { ErrorRejection } from '../rejections.js'
import type {
  ActionParamsType,
  ActionResultType,
  HandlerContext,
  RequestHandler,
} from '../types.js'
import { executeHandler } from '../utils.js'

export type RequestMessageOf<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<RequestActionPayloadOf<Name, Definitions[Name]>, Meta>

export function handleRequest<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string,
>(
  context: HandlerContext<Definitions, Meta>,
  message: RequestMessageOf<Definitions, Meta, Name>,
): ErrorRejection | Promise<void> {
  const { action, meta } = message
  const handler = context.handlers[action.name] as RequestHandler<
    ActionParamsType<Definitions, Name>,
    ActionResultType<Definitions, Name>,
    Meta
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for action: ${action.name}`, { info: action })
  }

  const controller = new AbortController()
  context.controllers[action.id] = controller

  const params = action.params as ActionParamsType<Definitions, Name>
  return executeHandler(context, action, () => handler({ params, meta, signal: controller.signal }))
}
