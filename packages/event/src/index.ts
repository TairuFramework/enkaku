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

import type { OmnipresentEventData, UnsubscribeFunction } from 'emittery'
import Emittery from 'emittery'

export type { Options } from 'emittery'

export class EventEmitter<
  Events extends Record<string, unknown>,
  AllEvents = Events & OmnipresentEventData,
> extends Emittery<Events, AllEvents> {
  on<Name extends keyof AllEvents>(
    eventName: Name | readonly Name[],
    listener: (eventData: AllEvents[Name]) => void | Promise<void>,
    options?: { filter?: (eventData: AllEvents[Name]) => boolean; signal?: AbortSignal },
  ): UnsubscribeFunction {
    const filter = options?.filter
    const listen = filter
      ? (eventData: AllEvents[Name]) => {
          if (filter(eventData)) {
            listener(eventData)
          }
        }
      : listener
    return super.on(eventName, listen, options)
  }

  readable<Name extends keyof AllEvents>(
    name: Name,
    options: { filter?: (eventData: AllEvents[Name]) => boolean; signal?: AbortSignal } = {},
  ): ReadableStream<AllEvents[Name]> {
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
