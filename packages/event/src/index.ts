/**
 *
 *
 * Simple events emitter based on EventTarget.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/event
 * ```
 *
 * @module event
 */

export class EventEmitter<
  Events extends Record<string, unknown>,
  EventType extends keyof Events & string = keyof Events & string,
> extends EventTarget {
  emit(type: EventType, detail: Events[EventType]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  on<Type extends EventType>(
    type: Type,
    listener: (event: CustomEvent<Events[Type]>) => void,
    options?: AddEventListenerOptions,
  ): () => void {
    this.addEventListener(type, listener as EventListener, options)
    return () => this.removeEventListener(type, listener as EventListener, options)
  }

  off<Type extends EventType>(
    type: Type,
    listener: (event: CustomEvent<Events[Type]>) => void,
    options?: EventListenerOptions,
  ): void {
    this.removeEventListener(type, listener as EventListener, options)
  }

  once<Type extends EventType>(
    type: Type,
    listener: (event: CustomEvent<Events[Type]>) => void,
    options: AddEventListenerOptions = {},
  ): () => void {
    const opts = { ...options, once: true }
    this.addEventListener(type, listener as EventListener, opts)
    return () => this.removeEventListener(type, listener as EventListener, opts)
  }

  next<Type extends EventType>(
    type: Type,
    options: AddEventListenerOptions = {},
  ): Promise<Events[Type]> {
    return new Promise((resolve, reject) => {
      const { signal } = options
      if (signal?.aborted) {
        reject(signal.reason)
      } else {
        const remove = this.once(
          type,
          (event) => {
            resolve((event as CustomEvent<Events[Type]>).detail)
          },
          options,
        )
        if (signal != null) {
          signal.addEventListener(
            'abort',
            () => {
              remove()
              reject(signal.reason)
            },
            { once: true },
          )
        }
      }
    })
  }

  readable<Type extends EventType>(
    type: Type,
    options: AddEventListenerOptions = {},
  ): ReadableStream<Events[Type]> {
    const abortController = new AbortController()
    const signal = options.signal
      ? AbortSignal.any([options.signal, abortController.signal])
      : abortController.signal

    let isClosed = false
    return new ReadableStream({
      start: (controller) => {
        if (!signal.aborted) {
          this.addEventListener(
            type,
            (event) => {
              controller.enqueue((event as CustomEvent<Events[Type]>).detail)
            },
            { ...options, signal },
          )
        }
        signal.addEventListener('abort', () => {
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

  writable(type: EventType): WritableStream<Events[EventType]> {
    return new WritableStream({
      write: (detail) => {
        this.emit(type, detail)
      },
    })
  }
}
