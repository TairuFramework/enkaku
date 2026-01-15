import { toPromise } from '@enkaku/async'
import type { ClientMessage, EventPayloadOf, ProtocolDefinition } from '@enkaku/protocol'

import { HandlerError } from '../error.js'
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

  ctx.logger.trace('handle event {procedure}', {
    procedure: msg.payload.prc,
    data: msg.payload.data,
  })

  const handlerContext = {
    message: msg,
    data: msg.payload.data,
  } as unknown as EventHandlerContext<Protocol, Procedure>
  return toPromise(() => handler(handlerContext)).catch((cause) => {
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: (cause as Error).message ?? 'Handler execution failed',
    })
    ctx.logger.debug('handler error for event {procedure}', {
      procedure: msg.payload.prc,
      data: msg.payload.data,
      error,
    })
    ctx.events.emit('handlerError', { error, payload: msg.payload })
  })
}
