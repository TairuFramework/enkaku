import type { AnyActionDefinitions, AnyServerMessageOf, OptionalRecord } from '@enkaku/protocol'

import { HandlerError } from './error.js'
import { ErrorRejection } from './rejections.js'
import type { ActionResultType, ExecuteHandlerActionPayload, HandlerContext } from './types.js'

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

// Replace by Promise.try() when widely available
export function toPromise<T = unknown>(execute: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(execute())
  } catch (err) {
    return Promise.reject(err)
  }
}

export async function executeHandler<
  Definitions extends AnyActionDefinitions,
  Name extends keyof Definitions & string,
  Meta extends OptionalRecord,
  Result extends ActionResultType<Definitions, Name> = ActionResultType<Definitions, Name>,
>(
  context: HandlerContext<Definitions, Meta>,
  action: ExecuteHandlerActionPayload,
  execute: () => Result | Promise<Result>,
): Promise<void> {
  const controller = context.controllers[action.id]
  try {
    const value = await toPromise(execute)
    if (!controller.signal.aborted) {
      await context.send({
        action: { type: 'result', id: action.id, value },
      } as AnyServerMessageOf<Definitions>)
    }
  } catch (cause) {
    if (!controller.signal.aborted) {
      context.send({
        action: {
          type: 'error',
          id: action.id,
          error: HandlerError.from(cause, { code: 'EKK2000', info: action }).toJSON(),
        },
      } as AnyServerMessageOf<Definitions>)
    }

    context.reject(
      new ErrorRejection(`Error handling action: ${action.name}`, { info: action, cause }),
    )
  } finally {
    delete context.controllers[action.id]
  }
}
