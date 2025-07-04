import { toPromise } from '@enkaku/async'

import type { Option } from './option.js'
import { Result } from './result.js'

// TODO: refactor flow package to use AsyncResult
// class TaskExecution extends AsyncResult<V, E> implements Abortable, Disposable

export type MappedResult<V, E extends Error = Error> =
  | V
  | PromiseLike<V>
  | Result<V, E>
  | PromiseLike<Result<V, E>>
  | AsyncResult<V, E>

// @ts-expect-error Promise.all() is not a generic method
export class AsyncResult<V, E extends Error = Error> extends Promise<Result<V, E>> {
  static [Symbol.species] = Promise

  static collect<V, E extends Error = Error>(
    values: Iterable<V | PromiseLike<V>>,
  ): AsyncResult<Array<AsyncResult<V, E>>, never> {
    const inputs = Array.from(values).map((value) => toPromise(() => value))
    const promise = Promise.allSettled(inputs).then((results) => {
      return results.map((result) => {
        return result.status === 'fulfilled'
          ? AsyncResult.ok<V, E>(result.value)
          : AsyncResult.error<V, E>(result.reason as E)
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
    return new AsyncResult(Promise.reject(Result.error(error)))
  }

  static resolve<V, E extends Error = Error>(value: V | PromiseLike<V>): AsyncResult<V, E> {
    return new AsyncResult(
      toPromise(() => value).then(
        (value) => Result.from<V, E>(value),
        (error) => Result.from<V, E>(error),
      ),
    )
  }

  static reject<V, E extends Error>(error: E): AsyncResult<V, E> {
    return new AsyncResult(Promise.reject(Result.error(error)))
  }

  #isSettled = false

  constructor(promise: PromiseLike<Result<V, E>>) {
    super((resolve) => {
      const onSettled = (value: Result<V, E>) => {
        this.#isSettled = true
        resolve(value)
      }
      promise.then(onSettled, onSettled)
    })
  }

  get isSettled(): boolean {
    return this.#isSettled
  }

  get optional(): Promise<Option<V>> {
    return this.then((self) => self.optional)
  }

  resolvedOr(defaultValue: V | PromiseLike<V>): Promise<V> {
    return this.then((self) => (self.isOK() ? self.value : defaultValue))
  }

  map<OutV, OutE extends Error = Error>(
    fn: (value: V) => MappedResult<OutV, OutE>,
  ): AsyncResult<OutV, E | OutE> {
    return new AsyncResult(
      this.then((self) => {
        return self.isError()
          ? self
          : toPromise(() => fn(self.value))
              .then(AsyncResult.from<OutV, OutE>)
              .catch((e) => AsyncResult.from(e as OutE))
      }),
    )
  }

  mapError<OutE extends Error = Error>(
    fn: (error: E) => MappedResult<V, OutE>,
  ): AsyncResult<V, E | OutE> {
    return new AsyncResult(
      this.then((self) => {
        return self.isError()
          ? toPromise(() => fn(self.error as E))
              .then(AsyncResult.from<V, OutE>)
              .catch((e) => AsyncResult.from(e as OutE))
          : self
      }),
    )
  }
}
