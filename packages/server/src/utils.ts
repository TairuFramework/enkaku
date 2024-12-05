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

// @ts-ignore type instantiation too deep
export async function executeHandler<
  Protocol extends ProtocolDefinition,
  Command extends keyof Protocol & string,
  Result extends ResultType<Protocol, Command> = ResultType<Protocol, Command>,
>(
  context: HandlerContext<Protocol>,
  payload: RequestPayloadOf<Command, Protocol[Command]>,
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
      } as unknown as AnyServerPayloadOf<Protocol>)
    }
  } catch (cause) {
    if (!controller.signal.aborted) {
      context.send(
        HandlerError.from(cause, {
          code: 'EK01',
          message: (cause as Error).message ?? 'Handler execution failed',
        }).toPayload(payload.rid) as AnyServerPayloadOf<Protocol>,
      )
    }

    context.reject(
      new ErrorRejection(`Error handling command: ${payload.cmd}`, { info: payload, cause }),
    )
  } finally {
    delete context.controllers[payload.rid]
  }
}
