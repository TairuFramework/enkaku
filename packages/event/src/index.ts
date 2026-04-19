/**
 *
 *
 * Simple events emitter.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/event
 * ```
 *
 * @module event
 */

export type UnsubscribeFunction = () => void

export type ListenerOptions<Data> = {
  filter?: (data: Data) => boolean
  signal?: AbortSignal
}

export type DatalessEventNames<Events extends Record<string, unknown>> = {
  [Key in keyof Events]: Events[Key] extends void ? Key : never
}[keyof Events]

export class EventEmitter<Events extends Record<string, unknown>> {
  #listeners = new Map<keyof Events, Set<(data: unknown) => void | Promise<void>>>()

  on<Name extends keyof Events>(
    name: Name,
    listener: (data: Events[Name]) => void | Promise<void>,
    options?: ListenerOptions<Events[Name]>,
  ): UnsubscribeFunction {
    const filter = options?.filter
    const wrappedListener = filter
      ? (data: unknown) => {
          if (filter(data as Events[Name])) {
            return listener(data as Events[Name])
          }
        }
      : (data: unknown) => {
          return listener(data as Events[Name])
        }

    let listeners = this.#listeners.get(name)
    if (!listeners) {
      listeners = new Set()
      this.#listeners.set(name, listeners)
    }
    listeners.add(wrappedListener)

    const off = () => {
      listeners.delete(wrappedListener)
    }

    const signal = options?.signal
    if (signal) {
      if (signal.aborted) {
        off()
      } else {
        signal.addEventListener('abort', () => off(), { once: true })
      }
    }
    return off
  }

  once<Name extends keyof Events>(
    name: Name,
    options?: ListenerOptions<Events[Name]>,
  ): Promise<Events[Name]> {
    return new Promise((resolve, reject) => {
      const signal = options?.signal
      if (signal?.aborted) {
        reject(signal.reason)
        return
      }
      const onAbort = signal
        ? () => {
            off()
            reject(signal.reason)
          }
        : undefined
      const off = this.on(
        name,
        (data) => {
          off()
          if (onAbort) {
            signal?.removeEventListener('abort', onAbort)
          }
          resolve(data)
        },
        { filter: options?.filter },
      )
      if (onAbort) {
        signal?.addEventListener('abort', onAbort, { once: true })
      }
    })
  }

  /**
   * Invokes every registered listener for `name` in parallel with the given
   * data. Listener rejections (sync throw or async reject) are absorbed —
   * `emit` always resolves — because the emitter caller is not responsible
   * for listener bugs and a single misbehaving listener must not turn every
   * fire-and-forget emit site into an unhandled-rejection source.
   *
   * Listeners that need to observe or report their own failures should catch
   * internally (e.g. log, forward to telemetry). The emitter does not offer
   * a `once-errored` signal; subscribe through normal channels instead.
   */
  emit<Name extends DatalessEventNames<Events>>(name: Name): Promise<void>
  /**
   * Invokes every registered listener for `name` in parallel with the given
   * data. Listener rejections (sync throw or async reject) are absorbed —
   * `emit` always resolves — because the emitter caller is not responsible
   * for listener bugs and a single misbehaving listener must not turn every
   * fire-and-forget emit site into an unhandled-rejection source.
   */
  emit<Name extends keyof Events>(name: Name, data: Events[Name]): Promise<void>
  async emit<Name extends keyof Events>(name: Name, data?: Events[Name]): Promise<void> {
    const listeners = this.#listeners.get(name)
    if (!listeners || listeners.size === 0) return
    await Promise.allSettled(
      [...listeners].map((fn) => {
        try {
          return fn(data)
        } catch (err) {
          return Promise.reject(err)
        }
      }),
    )
  }

  readable<Name extends keyof Events>(
    name: Name,
    options: ListenerOptions<Events[Name]> = {},
  ): ReadableStream<Events[Name]> {
    const abortController = new AbortController()
    const signal = options.signal
      ? AbortSignal.any([options.signal, abortController.signal])
      : abortController.signal

    let isClosed = false
    return new ReadableStream({
      start: (controller) => {
        if (signal.aborted) {
          isClosed = true
          controller.close()
          return
        }
        const off = this.on(name, (data) => controller.enqueue(data), {
          filter: options.filter,
          signal,
        })
        signal.addEventListener('abort', () => {
          off()
          if (!isClosed) {
            isClosed = true
            controller.close()
          }
        })
      },
      cancel() {
        isClosed = true
        abortController.abort()
      },
    })
  }

  writable<Name extends keyof Events>(name: Name): WritableStream<Events[Name]> {
    return new WritableStream({
      write: async (data) => {
        await this.emit(name, data)
      },
    })
  }
}
