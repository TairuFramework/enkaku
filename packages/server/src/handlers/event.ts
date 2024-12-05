import type { ClientMessage, EventPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { toPromise } from '@enkaku/util'

import { ErrorRejection } from '../rejections.js'
import type { EventHandler, EventHandlerContext, HandlerContext } from '../types.js'

export type EventMessageOf<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<EventPayloadOf<Command, Protocol[Command]>>

export function handleEvent<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: EventMessageOf<Protocol, Command>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.cmd] as EventHandler<Protocol, Command>
  if (handler == null) {
    return new ErrorRejection(`No handler for command: ${msg.payload.cmd}`, { info: msg.payload })
  }

  const handlerContext = {
    message: msg,
    data: msg.payload.data,
  } as unknown as EventHandlerContext<Protocol, Command>
  return toPromise(() => handler(handlerContext)).catch((cause) => {
    const err = new ErrorRejection(`Error handling command: ${msg.payload.cmd}`, {
      info: msg.payload,
      cause,
    })
    ctx.reject(err)
  })
}
