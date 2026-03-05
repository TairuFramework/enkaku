/**
 *
 *
 * Simple events emitter based on Emittery.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/event
 * ```
 *
 * @module event
 */

import type { UnsubscribeFunction } from 'emittery'
import Emittery from 'emittery'

export type { UnsubscribeFunction } from 'emittery'

export type ListenerOptions<Data> = {
  filter?: (data: Data) => boolean
  signal?: AbortSignal
}

export class EventEmitter<Events extends Record<string, unknown>> {
  #emitter = new Emittery<Events>()

  on<Name extends keyof Events>(
    name: Name,
    listener: (data: Events[Name]) => void | Promise<void>,
    options?: ListenerOptions<Events[Name]>,
  ): UnsubscribeFunction {
    const filter = options?.filter
    const wrappedListener = filter
      ? (event: unknown) => {
          const data = (event as { data: Events[Name] }).data
          if (filter(data)) {
            return listener(data)
          }
        }
      : (event: unknown) => {
          return listener((event as { data: Events[Name] }).data)
        }
    const off = this.#emitter.on(name, wrappedListener)
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

  async emit<Name extends keyof Events>(eventName: Name, eventData: Events[Name]): Promise<void> {
    try {
      await this.#emitter.emit(eventName, eventData)
    } catch (error) {
      if (error instanceof AggregateError && error.errors.length === 1) {
        throw error.errors[0]
      }
      throw error
    }
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
