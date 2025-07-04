import { defer } from './defer.js'
import { DisposeInterruption } from './interuptions.js'

export type DisposerParams = {
  dispose?: (reason?: unknown) => Promise<void>
  signal?: AbortSignal
}

/**
 * Disposer class, providing a dispose function and a disposed Promise.
 */
export class Disposer extends AbortController implements AsyncDisposable {
  #deferred = defer<void>()

  constructor(params: DisposerParams = {}) {
    super()

    let disposing = false
    this.signal.addEventListener(
      'abort',
      () => {
        if (!disposing) {
          disposing = true
          if (params.dispose == null) {
            this.#deferred.resolve()
          } else {
            params.dispose(this.signal.reason).then(() => this.#deferred.resolve())
          }
        }
      },
      { once: true },
    )
    params.signal?.addEventListener('abort', () => this.dispose(params.signal?.reason), {
      once: true,
    })
  }

  get disposed(): Promise<void> {
    return this.#deferred.promise
  }

  dispose(reason?: unknown): Promise<void> {
    this.abort(reason ?? new DisposeInterruption())
    return this.#deferred.promise
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.dispose()
  }
}
