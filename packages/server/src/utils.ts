import type { AnyServerPayloadOf, ProtocolDefinition, RequestPayloadOf } from '@enkaku/protocol'
import { toPromise } from '@enkaku/util'

import { HandlerError } from './error.js'
import { ErrorRejection } from './rejections.js'
import type { HandlerContext, ResultType } from './types.js'

export type ConsumeReaderParams<T> = {
  onDone?: () => void
  onValue: (value: T) => Promise<void>
  reader: ReadableStreamDefaultReader<T>
  signal: AbortSignal
}

export async function consumeReader<T>(params: ConsumeReaderParams<T>): Promise<void> {
  async function handle() {
    if (params.signal.aborted) {
      return
    }

    const next = await params.reader.read()
    if (next.done) {
      params.onDone?.()
      return
    }
    if (params.signal.aborted) {
      return
    }

    await params.onValue(next.value)
    handle()
  }

  handle()
}

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

    context.reject(
      // @ts-ignore type instantiation too deep
      new ErrorRejection(`Error handling procedure: ${payload.prc}`, { info: payload, cause }),
    )
  } finally {
    delete context.controllers[payload.rid]
  }
}
