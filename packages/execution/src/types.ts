import type { Interruption } from '@enkaku/async'
import type { AsyncResult, Result } from '@enkaku/result'

export type ExecutionResult<V, E extends Error = Error> =
  | V
  | PromiseLike<V>
  | Result<V, E | Interruption>
  | PromiseLike<Result<V, E | Interruption>>
  | AsyncResult<V, E | Interruption>

export type ExecuteFn<V, E extends Error = Error> = (signal: AbortSignal) => ExecutionResult<V, E>

export type ExecuteContext<V, E extends Error = Error> = {
  execute: ExecuteFn<V, E>
  cleanup?: () => void
  signal?: AbortSignal
  timeout?: number
}

export type Executable<V, E extends Error = Error> =
  | ExecuteFn<V, E>
  | PromiseLike<ExecuteFn<V, E>>
  | ExecuteContext<V, E>
  | PromiseLike<ExecuteContext<V, E>>

export type ChainFn<V, OutV, E extends Error = Error, OutE extends Error = Error> = (
  result: Result<V, E | Interruption>,
) => Executable<V | OutV, E | OutE> | null
