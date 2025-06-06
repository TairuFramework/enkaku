/**
 * Enkaku async utilities.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/async
 * ```
 *
 * @module async
 */

function noop() {}

/**
 * Deferred object, providing a Promise with associated resolve and reject function.
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

export type DisposerParams = {
  dispose?: () => Promise<void>
  signal?: AbortSignal
}

/**
 * Disposer class, providing a dispose function and a disposed Promise.
 */
export class Disposer extends AbortController implements AsyncDisposable {
  #deferred = defer<void>()
  #dispose?: (reason?: unknown) => Promise<void>

  constructor(params: DisposerParams = {}) {
    super()
    this.#dispose = params.dispose

    let disposing = false
    this.signal.addEventListener(
      'abort',
      () => {
        if (!disposing) {
          disposing = true
          this._dispose(this.signal.reason).then(() => this.#deferred.resolve())
        }
      },
      { once: true },
    )

    params.signal?.addEventListener('abort', () => this.dispose(params.signal?.reason), {
      once: true,
    })
  }

  /** @internal */
  async _dispose(reason?: unknown): Promise<void> {
    if (this.#dispose != null) {
      await this.#dispose(reason)
    }
  }

  get disposed(): Promise<void> {
    return this.#deferred.promise
  }

  dispose(reason?: unknown): Promise<void> {
    this.abort(reason ?? 'Dispose')
    return this.#deferred.promise
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.dispose()
  }
}

/**
 * Converts a function returning a value or promise to a Promise.
 */
export function toPromise<T = unknown>(execute: () => T | PromiseLike<T>): Promise<T> {
  return Promise.resolve().then(() => execute())
}

/**
 * Lazily run the `execute` function at most once when awaited.
 */
export function lazy<T>(execute: () => PromiseLike<T>): PromiseLike<T> {
  let promise: PromiseLike<T> | undefined
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

export function raceSignal<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(signal.reason)
      } else {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }
    }),
  ])
}
