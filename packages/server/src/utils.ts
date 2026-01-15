import { toPromise } from '@enkaku/async'
import type { AnyServerPayloadOf, ProtocolDefinition, RequestPayloadOf } from '@enkaku/protocol'

import { HandlerError } from './error.js'
import type { HandlerContext, ResultType } from './types.js'

function canSend(signal: AbortSignal): boolean {
  return !signal.aborted || signal.reason === 'Close'
}

// @ts-expect-error type instantiation too deep
export async function executeHandler<
  Protocol extends ProtocolDefinition,
  Procedure extends keyof Protocol & string,
  Result extends ResultType<Protocol, Procedure> = ResultType<Protocol, Procedure>,
>(
  context: HandlerContext<Protocol>,
  payload: RequestPayloadOf<Procedure, Protocol[Procedure]>,
  execute: () => Result | Promise<Result>,
): Promise<void> {
  const controller = context.controllers[payload.rid]
  try {
    const val = await toPromise(execute)
    if (canSend(controller.signal)) {
      context.logger.trace('send result to {type} {procedure} with ID {rid}', {
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
    const error = HandlerError.from(cause, {
      code: 'EK01',
      message: (cause as Error).message ?? 'Handler execution failed',
    })
    if (canSend(controller.signal)) {
      context.logger.trace('send error to {type} {procedure} with ID {rid}', {
        type: payload.typ,
        procedure: payload.prc,
        rid: payload.rid,
        error,
      })
      context.send(error.toPayload(payload.rid) as AnyServerPayloadOf<Protocol>)
    } else {
      context.logger.debug(
        'handler error for {type} {procedure} with ID {rid} cannot be sent to client',
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
