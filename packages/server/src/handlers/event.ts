import type {
  AnyActionDefinitions,
  ClientMessage,
  EventActionPayloadOf,
  OptionalRecord,
} from '@enkaku/protocol'

import { ErrorRejection } from '../rejections.js'
import type { EventDataType, EventHandler, HandlerContext } from '../types.js'

export type EventMessageOf<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<EventActionPayloadOf<Name, Definitions[Name]>, Meta>

export function handleEvent<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
  Name extends keyof Definitions & string,
>(
  context: HandlerContext<Definitions, Meta>,
  message: EventMessageOf<Definitions, Meta, Name>,
): ErrorRejection | Promise<void> {
  const { action, meta } = message
  const handler = context.handlers[action.name] as EventHandler<
    EventDataType<Definitions, Name>,
    Meta
  >
  if (handler == null) {
    return new ErrorRejection(`No handler for action ${action.name}`, { info: action })
  }

  const data = action.data as EventDataType<Definitions, Name>
  return Promise.resolve(handler({ data, meta })).catch((cause) => {
    const err = new ErrorRejection(`Error handling ${action.name}`, { info: action, cause })
    context.reject(err)
  })
}
