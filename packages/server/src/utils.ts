import { toPromise } from '@enkaku/async'
import type { AnyServerPayloadOf, ProtocolDefinition, RequestPayloadOf } from '@enkaku/protocol'

import { HandlerError } from './error.js'
import type { HandlerContext, ResultType } from './types.js'

function canSend(signal: AbortSignal): boolean {
  return !signal.aborted || signal.reason === 'Close'
}

// @ts-ignore type instantiation too deep
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
      await context.send({
        typ: 'result',
        rid: payload.rid,
        val,
      } as unknown as AnyServerPayloadOf<Protocol>)
    }
  } catch (cause) {
    if (canSend(controller.signal)) {
      context.send(
        HandlerError.from(cause, {
          code: 'EK01',
          message: (cause as Error).message ?? 'Handler execution failed',
        }).toPayload(payload.rid) as AnyServerPayloadOf<Protocol>,
      )
    }
    context.events.emit('handlerError', {
      error: new Error(`Error handling procedure: ${payload.prc}`, { cause }),
      rid: payload.rid,
      payload,
    })
  } finally {
    delete context.controllers[payload.rid]
  }
}
