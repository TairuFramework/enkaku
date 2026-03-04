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
  // @ts-expect-error -- intentionally narrowing the listener signature to unwrap emittery v2 envelopes
  override on<Name extends keyof AllEvents>(
    eventName: Name | readonly Name[],
    listener: (eventData: AllEvents[Name]) => void | Promise<void>,
    options?: { filter?: (eventData: AllEvents[Name]) => boolean; signal?: AbortSignal },
  ): UnsubscribeFunction {
    const filter = options?.filter
    const wrappedListener = filter
      ? (event: unknown) => {
          const data = (event as { data: AllEvents[Name] }).data
          if (filter(data)) {
            listener(data)
          }
        }
      : (event: unknown) => {
          listener((event as { data: AllEvents[Name] }).data)
        }
    return (super.on as unknown as (...args: Array<unknown>) => UnsubscribeFunction)(
      eventName,
      wrappedListener,
      options ? { signal: options.signal } : undefined,
    )
  }

  // @ts-expect-error -- intentionally changing once() to return raw data and support listener form
  override once<Name extends keyof AllEvents>(
    eventName: Name | readonly Name[],
  ): Promise<AllEvents[Name]>
  // @ts-expect-error -- intentionally changing once() to support listener callback form
  override once<Name extends keyof AllEvents>(
    eventName: Name | readonly Name[],
    listener: (eventData: AllEvents[Name]) => void | Promise<void>,
  ): UnsubscribeFunction
  // @ts-expect-error -- implementation signature intentionally differs from emittery v2
  override once<Name extends keyof AllEvents>(
    eventName: Name | readonly Name[],
    listener?: (eventData: AllEvents[Name]) => void | Promise<void>,
  ): Promise<AllEvents[Name]> | UnsubscribeFunction {
    if (listener) {
      // Listener form: use this.on() with auto-unsubscribe
      let off: UnsubscribeFunction
      off = this.on(eventName, (data) => {
        off()
        listener(data)
      })
      return off
    }
    // Promise form: implemented via this.on() to avoid super.once()/off() mismatch
    // (super.once() internally calls this.on() which wraps the listener, then tries
    // to this.off() the original unwrapped reference — which fails silently)
    return new Promise<AllEvents[Name]>((resolve) => {
      let off: UnsubscribeFunction
      off = this.on(eventName, (data) => {
        off()
        resolve(data)
      })
    })
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
