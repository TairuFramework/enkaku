import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  defer,
  Interruption,
  lazy,
  ScheduledTimeout,
  TimeoutInterruption,
  toPromise,
} from '@enkaku/async'

import { AsyncResult } from './async-result.js'
import type { Option } from './option.js'
import { Result } from './result.js'

function noop() {}

export type ExecutionResult<V, E extends Error = Error> =
  | V
  | PromiseLike<V>
  | Result<V, E | Interruption>
  | PromiseLike<Result<V, E | Interruption>>
  | AsyncResult<V, E | Interruption>

export type ExecuteFn<V, E extends Error = Error> = (signal: AbortSignal) => ExecutionResult<V, E>

export type Executable<V, E extends Error = Error> = (
  | ExecuteFn<V, E>
  | PromiseLike<ExecuteFn<V, E>>
) & {
  timeout?: number
}

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

  constructor(executable: Executable<V, E>, options: ExecutionOptions = {}) {
    const controller = new AbortController()
    const signals = [controller.signal]
    let timeout: ScheduledTimeout | undefined

    if (options.signal) {
      signals.push(options.signal)
    }
    if (options.timeout) {
      timeout = ScheduledTimeout.in(options.timeout, {
        message: 'Execution timed out',
      })
      signals.push(timeout.signal)
    }
    const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals)

    function execute(): Promise<Result<V, E | Interruption>> {
      if (signal.aborted) {
        const result = Result.toError<V, E | Interruption>(
          signal.reason,
          () => new AbortInterruption({ cause: signal.reason }),
        )
        return Promise.resolve(result)
      }

      const deferred = defer<Result<V, E | Interruption>, never>()
      toPromise(() => Promise.resolve(executable).then((execute) => execute(signal)))
        .then(Result.from<V, E | Interruption>, (cause) => {
          return Result.toError<V, E | Interruption>(
            cause,
            () => new Error('Execution failed', { cause }) as E,
          )
        })
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
      return deferred.promise
    }

    super(lazy(() => execute()))
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

  get value(): Promise<V> {
    return this.then((self) => self.value)
  }

  get optional(): Promise<Option<V>> {
    return this.then((self) => self.optional)
  }

  get orNull(): Promise<V | null> {
    return this.then((self) => self.orNull)
  }

  or(defaultValue: V): Promise<V> {
    return this.then((self) => self.or(defaultValue))
  }

  abort(reason?: unknown) {
    this.#timeout?.cancel()
    this.#controller.abort(reason ?? new AbortInterruption())
  }

  cancel(cause?: unknown) {
    this.abort(new CancelInterruption({ cause }))
  }

  chain<OutV, OutE extends Error = Error>(
    fn: (result: Result<V, E | Interruption>) => Executable<OutV, OutE>,
  ): Execution<V | OutV, E | OutE> {
    // TODO: support propagating signals
    return this.isInterrupted ? this : new Execution(lazy(() => this.then(fn)))
  }
}
