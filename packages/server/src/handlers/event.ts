import type { AnyDefinitions, ClientMessage, EventPayloadOf } from '@enkaku/protocol'
import { toPromise } from '@enkaku/util'

import { ErrorRejection } from '../rejections.js'
import type { EventDataType, EventHandler, HandlerContext } from '../types.js'

export type EventMessageOf<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string = keyof Definitions & string,
> = ClientMessage<EventPayloadOf<Command, Definitions[Command]>>

export function handleEvent<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
>(
  ctx: HandlerContext<Definitions>,
  msg: EventMessageOf<Definitions, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as EventHandler<EventDataType<Definitions, Command>>
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const data = msg.payload.data as EventDataType<Definitions, Command>
  return toPromise(() => handler({ data })).catch((cause) => {
    const err = new ErrorRejection(`Error handling command: ${msg.payload.cmd}`, {
      info: msg.payload,
      cause,
    })
    ctx.reject(err)
  })
}
