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

import Emittery from 'emittery'

export type { Options } from 'emittery'

export class EventEmitter<
  Events extends Record<string, unknown>,
  EventName extends keyof Events & string = keyof Events & string,
> extends Emittery<Events> {
  readable<Name extends EventName>(
    name: Name,
    options: { signal?: AbortSignal } = {},
  ): ReadableStream<Events[Name]> {
    const abortController = new AbortController()
    const signal = options.signal
      ? AbortSignal.any([options.signal, abortController.signal])
      : abortController.signal

    let isClosed = false
    return new ReadableStream({
      start: (controller) => {
        if (!signal.aborted) {
          const off = this.on(name, (data) => controller.enqueue(data), { signal })
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

  writable<Name extends EventName>(name: Name): WritableStream<Events[Name]> {
    return new WritableStream({
      write: async (detail) => {
        await this.emit(name, detail)
      },
    })
  }
}
