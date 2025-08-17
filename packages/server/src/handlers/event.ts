import { toPromise } from '@enkaku/async'
import type { ClientMessage, EventPayloadOf, ProtocolDefinition } from '@enkaku/protocol'

import type { EventHandler, EventHandlerContext, HandlerContext } from '../types.js'

export type EventMessageOf<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string = keyof Protocol & string,
> = ClientMessage<EventPayloadOf<Procedure, Protocol[Procedure]>>

export function handleEvent<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
>(ctx: HandlerContext<Protocol>, msg: EventMessageOf<Protocol, Procedure>): Error | Promise<void> {
  const handler = ctx.handlers[msg.payload.prc] as EventHandler<Protocol, Procedure>
  if (handler == null) {
    return new Error(`No handler for procedure: ${msg.payload.prc}`)
  }

  const handlerContext = {
    message: msg,
    data: msg.payload.data,
  } as unknown as EventHandlerContext<Protocol, Procedure>
  return toPromise(() => handler(handlerContext)).catch((cause) => {
    ctx.events.emit('handlerError', {
      error: new Error(`Error handling procedure: ${msg.payload.prc}`, { cause }),
      payload: msg.payload,
    })
  })
}
