function noop() {}

/**
 * Deferred objects, providing a Promise with associated resolve and reject function.
 */
export type Deferred<T, R = unknown> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: R) => void
}

/**
 * Create a Deferred object.
 */
export function defer<T, R = unknown>(): Deferred<T, R> {
  let resolve: (value: T | PromiseLike<T>) => void = noop
  let reject: (reason?: unknown) => void = noop
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type DisposerState = 'pending' | 'disposing' | 'disposed'

/**
 * Disposer object, providing a dispose function and a disposed Promise.
 */
export type Disposer = {
  dispose: () => Promise<void>
  disposed: Promise<void>
}

/**
 * Create a Disposer object from a function to execute on disposal and an optional AbortSignal.
 */
export function createDisposer(run: () => Promise<void>, signal?: AbortSignal): Disposer {
  const deferred = defer<void>()
  let state: DisposerState = 'pending'

  async function dispose(): Promise<void> {
    if (state === 'pending') {
      state = 'disposing'
      await run()
      state = 'disposed'
      deferred.resolve()
    }
    return deferred.promise
  }

  signal?.addEventListener('abort', () => {
    dispose()
  })

  return { dispose, disposed: deferred.promise }
}

/**
 * Converts a function returning a value or promise to a Promise.
 */
export function toPromise<T = unknown>(execute: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(execute())
  } catch (err) {
    return Promise.reject(err)
  }
}

/**
 * Lazily run the `execute` function at most once when awaited.
 */
export function lazy<T>(execute: () => Promise<T>): PromiseLike<T> {
  let promise: Promise<T> | undefined
  return {
    // biome-ignore lint/suspicious/noThenProperty: intentional PromiseLike
    then: (onfullfilled, onrejected) => {
      if (!promise) {
        promise = execute()
      }
      return promise.then(onfullfilled, onrejected)
    },
  }
}
