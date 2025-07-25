import { Option } from './option.js'

type ResultState<T, E extends Error> =
  | { ok: true; value: T; error: never }
  | { ok: false; value: never; error: E }

export class Result<V, E extends Error = Error> {
  static from<V, E extends Error = Error>(value: unknown): Result<V, E> {
    return Result.is<V, E>(value)
      ? value
      : value instanceof Error
        ? Result.error(value as E)
        : Result.ok(value as V)
  }

  static is<V, E extends Error = Error>(value: unknown): value is Result<V, E> {
    return value instanceof Result
  }

  static ok<V, E extends Error = Error>(value: V): Result<V, E> {
    return new Result({ ok: true, value, error: undefined as never })
  }

  static error<V, E extends Error = Error>(error: E): Result<V, E> {
    return new Result({ ok: false, value: undefined as never, error })
  }

  static toError<V, E extends Error = Error>(cause: unknown, createError?: () => E): Result<V, E> {
    const error =
      cause instanceof Error
        ? cause
        : createError
          ? createError()
          : new Error('Unknown error', { cause })
    return Result.error(error as E)
  }

  #state: ResultState<V, E>
  #optional?: Option<V>

  constructor(state: ResultState<V, E>) {
    this.#state = state
  }

  isOK(): this is Result<V, never> {
    return this.#state.ok
  }

  isError(): this is Result<never, E> {
    return !this.#state.ok
  }

  get error() {
    return this.isError() ? this.#state.error : null
  }

  get value(): V {
    if (this.isOK()) {
      return this.#state.value
    }
    throw this.#state.error
  }

  get optional(): Option<V> {
    if (this.#optional == null) {
      this.#optional = this.isOK() ? Option.some(this.#state.value) : Option.none()
    }
    return this.#optional
  }

  get orNull(): V | null {
    return this.isOK() ? this.#state.value : null
  }

  or(defaultValue: V): V {
    return this.isOK() ? this.#state.value : defaultValue
  }

  map<OutV, OutE extends Error = Error>(
    fn: (value: V) => OutV | Result<OutV, OutE>,
  ): Result<OutV, E | OutE> {
    if (this.isError()) {
      return this
    }

    try {
      const result = fn(this.#state.value)
      return Result.is(result) ? result : Result.ok(result)
    } catch (error) {
      return Result.error(error as OutE)
    }
  }

  mapError<OutE extends Error = Error>(
    fn: (error: E) => OutE | Result<V, OutE>,
  ): Result<V, E | OutE> {
    if (this.isOK()) {
      return this
    }

    try {
      const result = fn(this.#state.error as E)
      return Result.from(result)
    } catch (error) {
      return Result.from(error as OutE)
    }
  }
}
