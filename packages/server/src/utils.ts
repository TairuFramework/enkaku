import type {
  AnyDefinitions,
  AnyServerPayloadOf,
  RequestCallPayload,
  RequestType,
} from '@enkaku/protocol'
import { toPromise } from '@enkaku/util'

import { HandlerError } from './error.js'
import { ErrorRejection } from './rejections.js'
import type { HandlerContext, ParamsType, ResultType } from './types.js'

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

export async function executeHandler<
  Definitions extends AnyDefinitions,
  Command extends keyof Definitions & string,
  Result extends ResultType<Definitions, Command> = ResultType<Definitions, Command>,
>(
  context: HandlerContext<Definitions>,
  payload: RequestCallPayload<RequestType, Command, ParamsType<Definitions, Command>>,
  execute: () => Result | Promise<Result>,
): Promise<void> {
  const controller = context.controllers[payload.rid]
  try {
    const val = await toPromise(execute)
    if (!controller.signal.aborted) {
      await context.send({
        typ: 'result',
        rid: payload.rid,
        val,
      } as AnyServerPayloadOf<Definitions>)
    }
  } catch (cause) {
    if (!controller.signal.aborted) {
      context.send(
        HandlerError.from(cause, {
          code: 'EKK2000',
          message: 'Error code EKK2000',
        }).toPayload(payload.rid) as AnyServerPayloadOf<Definitions>,
      )
    }

    context.reject(
      new ErrorRejection(`Error handling command: ${payload.cmd}`, { info: payload, cause }),
    )
  } finally {
    delete context.controllers[payload.rid]
  }
}
