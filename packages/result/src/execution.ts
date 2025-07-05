import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  defer,
  Interruption,
  ScheduledTimeout,
  TimeoutInterruption,
  toPromise,
} from '@enkaku/async'

import { AsyncResult } from './async-result.js'
import { Result } from './result.js'

function noop() {}

export type ExecutionResult<V, E extends Error = Error> =
  | V
  | PromiseLike<V>
  | Result<V, E | Interruption>
  | PromiseLike<Result<V, E | Interruption>>
  | AsyncResult<V, E | Interruption>

export type ExecuteFn<V, E extends Error = Error> = (signal: AbortSignal) => ExecutionResult<V, E>

export type ExecutionOptions = {
  signal?: AbortSignal
  timeout?: number
}

export class Execution<V, E extends Error = Error>
  extends AsyncResult<V, E | Interruption>
  implements AbortController, AsyncDisposable
{
  #controller: AbortController
  #signal: AbortSignal
  #timeout?: ScheduledTimeout

  constructor(execute: ExecuteFn<V, E>, options: ExecutionOptions = {}) {
    const controller = new AbortController()
    const signals = [controller.signal]
    let timeout: ScheduledTimeout | undefined

    if (options.signal) {
      signals.push(options.signal)
    }
    if (options.timeout) {
      timeout = ScheduledTimeout.in(options.timeout)
      signals.push(timeout.signal)
    }

    let promise: PromiseLike<Result<V, E | Interruption>>
    const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals)
    if (signal.aborted) {
      promise = AsyncResult.error(signal.reason)
    } else {
      const deferred = defer<Result<V, E | Interruption>, never>()
      toPromise(() => execute(signal))
        .then(
          (value) => Result.from<V, E | Interruption>(value as V),
          (cause) => {
            return Result.toError<V, E | Interruption>(
              cause,
              () => new Error('Execution failed', { cause }) as E,
            )
          },
        )
        .then(deferred.resolve)
      signal.addEventListener(
        'abort',
        () => {
          const result = Result.toError<V, E | Interruption>(
            signal.reason,
            () => new AbortInterruption({ cause: signal.reason }),
          )
          deferred.resolve(result)
        },
        { once: true },
      )
      promise = deferred.promise
    }

    super(promise)
    this.#controller = controller
    this.#signal = signal
    this.#timeout = timeout
  }

  [Symbol.asyncDispose]() {
    this.abort(new DisposeInterruption())
    return this.then(noop, noop)
  }

  get isAborted(): boolean {
    return this.#signal.aborted
  }

  get isInterrupted(): boolean {
    return this.#signal.reason instanceof Interruption
  }

  get isCanceled(): boolean {
    return this.#signal.reason instanceof CancelInterruption
  }

  get isDisposed(): boolean {
    return this.#signal.reason instanceof DisposeInterruption
  }

  get isTimedOut(): boolean {
    return this.#signal.reason instanceof TimeoutInterruption
  }

  get signal() {
    return this.#signal
  }

  abort(reason?: unknown) {
    this.#timeout?.cancel()
    this.#controller.abort(reason ?? new AbortInterruption())
  }

  cancel(cause?: unknown) {
    this.abort(new CancelInterruption({ cause }))
  }
}
