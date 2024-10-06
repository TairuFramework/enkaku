import type {
  AnyActionDefinitions,
  AnyServerMessageOf,
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
    return new ErrorRejection(`No handler for action ${action.name}`, { info: action })
  }

  const controller = new AbortController()
  context.controllers[action.id] = controller

  const params = action.params as ActionParamsType<Definitions, Name>
  return Promise.resolve(handler({ params, meta, signal: controller.signal }))
    .then((value) => {
      if (!controller.signal.aborted) {
        return context.send({
          action: {
            type: 'result',
            id: action.id,
            value,
          },
        } as AnyServerMessageOf<Definitions>)
      }
    })
    .catch((cause) => {
      const err = new ErrorRejection(`Error handling ${action.name}`, { info: action, cause })
      context.reject(err)
    })
    .finally(() => {
      delete context.controllers[action.id]
    })
}
