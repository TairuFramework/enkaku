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
import { AsyncResult, type Option, Result } from '@enkaku/result'

import type { ChainFn, Executable, ExecuteContext } from './types.js'

function noop() {}

function toContext<V, E extends Error = Error>(
  executable: Executable<V, E>,
): Promise<ExecuteContext<V, E>> {
  return Promise.resolve(executable).then((execute) => {
    return typeof execute === 'function' ? { execute } : execute
  })
}

type ExecutionContext<V = unknown, E extends Error = Error> = {
  parent?: Execution<V, E>
  signal?: AbortSignal
  timeout?: number
}

export class Execution<V, E extends Error = Error>
  extends AsyncResult<V, E | Interruption>
  implements AbortController, AsyncDisposable, AsyncIterable<Result<unknown, Error | Interruption>>
{
  #cleanup?: () => void
  #controller: AbortController
  #chainSignal?: AbortSignal
  #chainTimeout?: ScheduledTimeout
  #executableTimeout?: ScheduledTimeout
  #parent?: Execution<unknown, Error>
  #signal: AbortSignal

  constructor(executable: Executable<V, E>, executionContext: ExecutionContext = {}) {
    const chainSignals: Array<AbortSignal> = []
    if (executionContext.signal) {
      chainSignals.push(executionContext.signal)
    }

    const controller = new AbortController()
    const executableSignals = [controller.signal]

    const execute = (ctx: ExecuteContext<V, E>): Promise<Result<V, E | Interruption>> => {
      if (executionContext.timeout) {
        this.#chainTimeout = ScheduledTimeout.in(executionContext.timeout, {
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

      if (this.#chainTimeout || this.#executableTimeout || ctx.cleanup) {
        this.#cleanup = () => {
          this.#chainTimeout?.cancel()
          this.#executableTimeout?.cancel()
          ctx.cleanup?.()
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
    this.#parent = executionContext.parent
    this.#signal = executionContext.signal
      ? AbortSignal.any([executionContext.signal, controller.signal])
      : controller.signal
  }

  [Symbol.asyncDispose]() {
    this.abort(new DisposeInterruption())
    return this.then(noop, noop)
  }

  async *[Symbol.asyncIterator]() {
    const chain: Array<Execution<unknown, Error | Interruption>> = []
    let current: Execution<unknown, Error | Interruption> | undefined = this
    while (current) {
      chain.unshift(current)
      current = current.#parent
    }

    let previous: Result<unknown, Error | Interruption> | undefined
    for (const execution of chain) {
      const result = await execution.execute()
      if (result !== previous) {
        previous = result
        yield result
      }
    }
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
    fn: ChainFn<V, OutV, E, OutE>,
  ): Execution<V | OutV, E | OutE> {
    const nextContext = lazy(async () => {
      const result = await this.execute()
      const executable = fn(result)
      if (executable == null) {
        return {
          cleanup: () => this.#cleanup?.(),
          execute: () => result,
          signal: this.#signal,
        } as ExecuteContext<V, E>
      }

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
    return new Execution(nextContext, { parent: this })
  }

  chainError<OutV, OutE extends Error = Error>(
    fn: (error: E | Interruption) => Executable<OutV, OutE> | null,
  ): Execution<V | OutV, E | OutE> {
    return this.chain((result) => (result.isError() ? fn(result.error as E | Interruption) : null))
  }

  chainOK<OutV, OutE extends Error = Error>(
    fn: (value: V) => Executable<OutV, OutE> | null,
  ): Execution<V | OutV, E | OutE> {
    return this.chain((result) => (result.isOK() ? fn(result.value) : null))
  }

  execute(): Promise<Result<V, E | Interruption>> {
    return this.then()
  }

  generate<V = unknown, E extends Error = Error>(): AsyncGenerator<Result<V, E | Interruption>> {
    return this[Symbol.asyncIterator]() as AsyncGenerator<Result<V, E | Interruption>>
  }
}
