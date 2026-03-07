import { toPromise } from '@enkaku/async'
import type { AnyServerPayloadOf, ProtocolDefinition } from '@enkaku/protocol'

import { HandlerError } from './error.js'
import type { HandlerContext } from './types.js'

function canSend(signal: AbortSignal): boolean {
  return !signal.aborted || signal.reason === 'Close'
}

export type ExecuteHandlerParams<Protocol extends ProtocolDefinition> = {
  context: HandlerContext<Protocol>
  payload: { typ: string; prc: string; rid: string }
  execute: () => unknown
  beforeEnd?: () => Promise<void>
}

export async function executeHandler<Protocol extends ProtocolDefinition>(
  params: ExecuteHandlerParams<Protocol>,
): Promise<void> {
  const { context, payload, execute, beforeEnd } = params
  const controller = context.controllers[payload.rid]
  try {
    const val = await toPromise(execute)
    if (beforeEnd != null) {
      await beforeEnd()
    }
    if (canSend(controller.signal)) {
      context.logger.trace('send result to {type} {procedure} with ID {rid}: {result}', {
        type: payload.typ,
        procedure: payload.prc,
        rid: payload.rid,
        result: val,
      })
      await context.send({
        typ: 'result',
        rid: payload.rid,
        val,
      } as unknown as AnyServerPayloadOf<Protocol>)
    }
  } catch (cause) {
    if (beforeEnd != null) {
      await beforeEnd()
    }
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: 'Handler execution failed',
    })
    if (canSend(controller.signal)) {
      context.logger.trace('send error to {type} {procedure} with ID {rid}: {error}', {
        type: payload.typ,
        procedure: payload.prc,
        rid: payload.rid,
        error,
      })
      context.send(error.toPayload(payload.rid) as AnyServerPayloadOf<Protocol>)
    } else {
      context.logger.debug(
        'handler error for {type} {procedure} with ID {rid} cannot be sent to client: {error}',
        {
          type: payload.typ,
          procedure: payload.prc,
          rid: payload.rid,
          error,
        },
      )
    }
    context.events.emit('handlerError', { error, payload })
  } finally {
    delete context.controllers[payload.rid]
  }
}
