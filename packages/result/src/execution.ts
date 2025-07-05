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

export type ExecutionOptions = {
  cleanup?: () => void
  signal?: AbortSignal
  timeout?: number
}

export type ExecutionContext<V, E extends Error = Error> = ExecutionOptions & {
  execute: ExecuteFn<V, E>
}

function toContext<V, E extends Error = Error>(
  executable: Executable<V, E>,
): Promise<ExecutionContext<V, E>> {
  return Promise.resolve(executable).then((execute) => {
    return typeof execute === 'function' ? { execute } : execute
  })
}

export type Executable<V, E extends Error = Error> =
  | ExecuteFn<V, E>
  | PromiseLike<ExecuteFn<V, E>>
  | ExecutionContext<V, E>
  | PromiseLike<ExecutionContext<V, E>>

export class Execution<V, E extends Error = Error>
  extends AsyncResult<V, E | Interruption>
  implements AbortController, AsyncDisposable
{
  #cleanup?: () => void
  #controller: AbortController
  #chainSignal?: AbortSignal
  #chainTimeout?: ScheduledTimeout
  #executableTimeout?: ScheduledTimeout
  #signal: AbortSignal

  constructor(executable: Executable<V, E>, options: ExecutionOptions = {}) {
    const chainSignals: Array<AbortSignal> = []
    if (options.signal) {
      chainSignals.push(options.signal)
    }

    const controller = new AbortController()
    const executableSignals = [controller.signal]

    const execute = (ctx: ExecutionContext<V, E>): Promise<Result<V, E | Interruption>> => {
      if (options.timeout) {
        this.#chainTimeout = ScheduledTimeout.in(options.timeout, {
          message: 'Execution chain timed out',
        })
        chainSignals.push(this.#chainTimeout.signal)
      }

      if (ctx.signal) {
        // Propagate signal from first executable down the chain
        chainSignals.push(ctx.signal)
      }
      if (ctx.timeout) {
        this.#executableTimeout = ScheduledTimeout.in(ctx.timeout, {
          message: 'Execution timed out',
        })
        executableSignals.push(this.#executableTimeout.signal)
      }

      if (this.#chainTimeout || this.#executableTimeout || options.cleanup) {
        this.#cleanup = () => {
          this.#chainTimeout?.cancel()
          this.#executableTimeout?.cancel()
          options.cleanup?.()
        }
      }

      if (chainSignals.length !== 0) {
        this.#chainSignal =
          chainSignals.length === 1 ? chainSignals[0] : AbortSignal.any(chainSignals)
      }

      const allSignals = [...chainSignals, ...executableSignals]
      const signal = allSignals.length === 1 ? allSignals[0] : AbortSignal.any(allSignals)
      this.#signal = signal

      if (signal.aborted) {
        const result = Result.toError<V, E | Interruption>(
          signal.reason,
          () => new AbortInterruption({ cause: signal.reason }),
        )
        return Promise.resolve(result)
      }

      const deferred = defer<Result<V, E | Interruption>, never>()
      toPromise(() => ctx.execute(signal))
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

    super(lazy(() => toContext(executable).then(execute)))
    this.#controller = controller
    this.#signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal
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
    this.#cleanup?.()
    this.#controller.abort(reason ?? new AbortInterruption())
  }

  cancel(cause?: unknown) {
    this.abort(new CancelInterruption({ cause }))
  }

  chain<OutV, OutE extends Error = Error>(
    fn: (result: Result<V, E | Interruption>) => Executable<OutV, OutE>,
  ): Execution<V | OutV, E | OutE> {
    if (this.isAborted) {
      return this
    }

    const nextContext = lazy(async () => {
      const executable = await this.then(fn)
      const ctx = await toContext(executable)
      const cleanup = () => {
        ctx.cleanup?.()
        this.#cleanup?.()
      }
      const signal = this.#chainSignal
        ? ctx.signal
          ? AbortSignal.any([this.#chainSignal, ctx.signal])
          : this.#chainSignal
        : ctx.signal
      return { ...ctx, cleanup, signal }
    })
    return new Execution(nextContext)
  }
}
