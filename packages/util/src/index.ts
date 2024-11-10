function noop() {}

export type Deferred<T, R = unknown> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: R) => void
}

// Replace by Promise.withResolvers() when widely available
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

export type Disposer = {
  dispose: () => Promise<void>
  disposed: Promise<void>
}

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

// Replace by Promise.try() when widely available
export function toPromise<T = unknown>(execute: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(execute())
  } catch (err) {
    return Promise.reject(err)
  }
}

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
