export type ExecuteFn<T> = (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void

export class LazyPromise<T> extends Promise<T> {
  static from<T>(execute: () => T | PromiseLike<T>) {
    return new LazyPromise<T>((resolve) => {
      resolve(execute() as T)
    })
  }

  static resolve(): LazyPromise<void>
  static resolve<T>(value: T): LazyPromise<T>
  static resolve<T>(value?: T): LazyPromise<T> {
    return new LazyPromise((resolve) => {
      resolve(value as T)
    })
  }

  static reject(reason: unknown) {
    return new LazyPromise<never>((_, reject) => {
      reject(reason)
    })
  }

  #execute: ExecuteFn<T>
  #promise?: Promise<T>

  constructor(execute: ExecuteFn<T>) {
    super((resolve) => resolve(undefined as T))
    this.#execute = execute
  }

  // biome-ignore lint/suspicious/noThenProperty: expected behavior
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): Promise<TResult1 | TResult2> {
    this.#promise ??= new Promise(this.#execute)
    return this.#promise.then(onFulfilled, onRejected)
  }

  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null | undefined,
  ): Promise<T | TResult> {
    this.#promise ??= new Promise(this.#execute)
    return this.#promise.catch(onRejected)
  }

  finally(onFinally?: (() => void | PromiseLike<void>) | null | undefined): Promise<T> {
    this.#promise ??= new Promise(this.#execute)
    return this.#promise.finally(onFinally)
  }
}

/**
 * Lazily run the `execute` function at most once when awaited.
 */
export function lazy<T>(execute: () => T | PromiseLike<T>): LazyPromise<T> {
  return LazyPromise.from<T>(execute)
}
