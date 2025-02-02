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

export type EventEmitterParams = {
  target?: EventTarget
}

export class EventEmitter<
  Events extends Record<string, unknown>,
  EventType extends keyof Events & string = keyof Events & string,
> {
  #target: EventTarget

  constructor(params: EventEmitterParams = {}) {
    this.#target = params.target ?? new EventTarget()
  }

  emit(type: EventType, detail: Events[EventType]): void {
    this.#target.dispatchEvent(new CustomEvent(type, { detail }))
  }

  on<Type extends EventType>(
    type: Type,
    callback: (data: Events[Type]) => void,
    options: AddEventListenerOptions = {},
  ): () => void {
    const listener = (event: CustomEvent<Events[Type]>) => callback(event.detail)
    const opts: AddEventListenerOptions = { passive: true, ...options }
    this.#target.addEventListener(type, listener as EventListener, opts)
    return () => this.#target.removeEventListener(type, listener as EventListener, opts)
  }

  once<Type extends EventType>(
    type: Type,
    callback: (data: Events[Type]) => void,
    options: AddEventListenerOptions = {},
  ): () => void {
    return this.on(type, callback, { ...options, once: true })
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
        const off = this.once(type, resolve, options)
        if (signal != null) {
          signal.addEventListener(
            'abort',
            () => {
              off()
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
          const off = this.on(type, (data) => controller.enqueue(data), { ...options, signal })
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

  writable(type: EventType): WritableStream<Events[EventType]> {
    return new WritableStream({
      write: (detail) => {
        this.emit(type, detail)
      },
    })
  }
}
