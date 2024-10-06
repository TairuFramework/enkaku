function noop() {}

export type Deferred<T, R = unknown> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: R) => void
}

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
