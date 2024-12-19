import type { ClientMessage, EventPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { toPromise } from '@enkaku/util'

import { ErrorRejection } from '../rejections.js'
import type { EventHandler, EventHandlerContext, HandlerContext } from '../types.js'

export type EventMessageOf<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<EventPayloadOf<Procedure, Protocol[Procedure]>>

export function handleEvent<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(
  ctx: HandlerContext<Protocol>,
  msg: EventMessageOf<Protocol, Procedure>,
): ErrorRejection | Promise<void> {
  const handler = ctx.handlers[msg.payload.prc] as EventHandler<Protocol, Procedure>
  if (handler == null) {
    return new ErrorRejection(`No handler for procedure: ${msg.payload.prc}`, { info: msg.payload })
  }

  const handlerContext = {
    message: msg,
    data: msg.payload.data,
  } as unknown as EventHandlerContext<Protocol, Procedure>
  return toPromise(() => handler(handlerContext)).catch((cause) => {
    const err = new ErrorRejection(`Error handling procedure: ${msg.payload.prc}`, {
      info: msg.payload,
      cause,
    })
    ctx.reject(err)
  })
}
