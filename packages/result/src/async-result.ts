import { toPromise } from '@enkaku/async'

import type { Option } from './option.js'
import { Result } from './result.js'

export type MappedResult<V, E extends Error = Error> =
  | V
  | PromiseLike<V>
  | Result<V, E>
  | PromiseLike<Result<V, E>>
  | AsyncResult<V, E>

export class AsyncResult<V, E extends Error = Error> implements PromiseLike<Result<V, E>> {
  static [Symbol.species] = Promise

  static all<V, E extends Error = Error>(
    values: Iterable<V | PromiseLike<V>>,
  ): AsyncResult<Array<Result<V, E>>, never> {
    const inputs = Array.from(values).map((value) => toPromise(() => value))
    const promise = Promise.allSettled(inputs).then((results) => {
      return results.map((result) => {
        return result.status === 'fulfilled'
          ? Result.ok<V, E>(result.value)
          : Result.error<V, E>(result.reason as E)
      })
    })
    return AsyncResult.resolve(promise)
  }

  static from<V, E extends Error = Error>(value: unknown): AsyncResult<V, E> {
    return AsyncResult.is<V, E>(value)
      ? value
      : value instanceof Error
        ? AsyncResult.error<V, E>(value as E)
        : AsyncResult.resolve(value as V)
  }

  static is<V, E extends Error = Error>(value: unknown): value is AsyncResult<V, E> {
    return value instanceof AsyncResult
  }

  static ok<V, E extends Error = Error>(value: V): AsyncResult<V, E> {
    return new AsyncResult(Promise.resolve(Result.ok(value)))
  }

  static error<V, E extends Error = Error>(error: E): AsyncResult<V, E> {
    return new AsyncResult(Promise.resolve(Result.error(error)))
  }

  static resolve<V, E extends Error = Error>(value: V | PromiseLike<V>): AsyncResult<V, E> {
    return new AsyncResult(
      toPromise(() => value)
        .then(Result.from<V, E>)
        .catch(Result.toError<V, E>),
    )
  }

  #promise: Promise<Result<V, E>>

  constructor(promise: Promise<Result<V, E>>) {
    this.#promise = promise
  }

  get value(): Promise<V> {
    return this.#promise.then((self) => self.value)
  }

  get optional(): Promise<Option<V>> {
    return this.#promise.then((self) => self.optional)
  }

  get orNull(): Promise<V | null> {
    return this.#promise.then((self) => self.orNull)
  }

  // biome-ignore lint/suspicious/noThenProperty: expected behavior
  then<TResult1 = Result<V, E>, TResult2 = never>(
    onfulfilled?: ((value: Result<V, E>) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected)
  }

  or(defaultValue: V): Promise<V> {
    return this.#promise.then((self) => self.or(defaultValue))
  }

  map<OutV, OutE extends Error = Error>(
    fn: (value: V) => MappedResult<OutV, OutE>,
  ): AsyncResult<OutV, E | OutE> {
    return new AsyncResult(
      this.#promise.then((self) => {
        if (self.isError()) {
          return self as unknown as Result<OutV, E | OutE>
        }
        return toPromise(() => fn(self.value))
          .then(Result.from<OutV, OutE>)
          .catch(Result.toError<OutV, OutE>)
      }),
    )
  }

  mapError<OutE extends Error = Error>(
    fn: (error: E) => MappedResult<V, OutE>,
  ): AsyncResult<V, E | OutE> {
    return new AsyncResult(
      this.#promise.then((self) => {
        if (self.isOK()) {
          return self as unknown as Result<V, E | OutE>
        }
        return toPromise(() => fn(self.error as E))
          .then(Result.from<V, E | OutE>)
          .catch(Result.toError<V, E | OutE>)
      }),
    )
  }
}
