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

export class EventEmitter<Events extends Record<string, unknown>> {
  #emitter = new Emittery<Events>()

  on<Name extends keyof Events>(
    eventName: Name | readonly Name[],
    listener: (eventData: Events[Name]) => void | Promise<void>,
    options?: { filter?: (eventData: Events[Name]) => boolean; signal?: AbortSignal },
  ): UnsubscribeFunction {
    const filter = options?.filter
    const wrappedListener = filter
      ? (event: unknown) => {
          const data = (event as { data: Events[Name] }).data
          if (filter(data)) {
            listener(data)
          }
        }
      : (event: unknown) => {
          listener((event as { data: Events[Name] }).data)
        }
    return (this.#emitter.on as unknown as (...args: Array<unknown>) => UnsubscribeFunction)(
      eventName,
      wrappedListener,
      options ? { signal: options.signal } : undefined,
    )
  }

  once<Name extends keyof Events>(eventName: Name | readonly Name[]): Promise<Events[Name]>
  once<Name extends keyof Events>(
    eventName: Name | readonly Name[],
    listener: (eventData: Events[Name]) => void | Promise<void>,
  ): UnsubscribeFunction
  once<Name extends keyof Events>(
    eventName: Name | readonly Name[],
    listener?: (eventData: Events[Name]) => void | Promise<void>,
  ): Promise<Events[Name]> | UnsubscribeFunction {
    if (listener) {
      let off: UnsubscribeFunction
      off = this.on(eventName, (data) => {
        off()
        listener(data)
      })
      return off
    }
    return new Promise<Events[Name]>((resolve) => {
      let off: UnsubscribeFunction
      off = this.on(eventName, (data) => {
        off()
        resolve(data)
      })
    })
  }

  async emit<Name extends keyof Events>(eventName: Name, eventData: Events[Name]): Promise<void> {
    await this.#emitter.emit(eventName, eventData)
  }

  readable<Name extends keyof Events>(
    name: Name,
    options: { filter?: (eventData: Events[Name]) => boolean; signal?: AbortSignal } = {},
  ): ReadableStream<Events[Name]> {
    const abortController = new AbortController()
    const signal = options.signal
      ? AbortSignal.any([options.signal, abortController.signal])
      : abortController.signal

    let isClosed = false
    return new ReadableStream({
      start: (controller) => {
        if (!signal.aborted) {
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
        }
      },
      cancel() {
        isClosed = true
        abortController.abort()
      },
    })
  }

  writable<Name extends keyof Events>(name: Name): WritableStream<Events[Name]> {
    return new WritableStream({
      write: async (detail) => {
        await this.emit(name, detail)
      },
    })
  }
}
