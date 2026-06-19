/**
 * Enkaku generator utilities.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/generator
 * ```
 *
 * @module generator
 */

import { type Deferred, defer } from '@enkaku/async'
import type { EventEmitter } from '@enkaku/event'

export function consume<T, TReturn = unknown>(
  iterator: AsyncIterator<T, TReturn>,
  callback: (value: T) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<TReturn> {
  let closed = false
  const ended = defer<TReturn>()

  const close = () => {
    if (closed) return
    closed = true
    // Run the source's cleanup (finally blocks). Swallow errors so cleanup
    // failures never mask the resolve/reject reason already settled below.
    Promise.resolve(iterator.return?.()).catch(() => {})
  }

  const abort = () => {
    close()
    ended.reject(signal?.reason)
  }

  if (signal?.aborted) {
    // Already aborted: settle immediately; the listener won't fire for
    // signals that are aborted before addEventListener is called.
    abort()
  } else {
    signal?.addEventListener('abort', abort)
  }

  async function pull() {
    if (signal?.aborted) return
    try {
      const { done, value } = await iterator.next()
      if (signal?.aborted || done) {
        if (done && !signal?.aborted) {
          ended.resolve(value)
        }
        close()
        return
      }

      await callback(value)
      void pull()
    } catch (reason) {
      close()
      ended.reject(reason)
    }
  }
  void pull()

  return ended.promise
}

export function fromEmitter<
  Events extends Record<string, unknown>,
  EventName extends keyof Events & string = keyof Events & string,
>(
  emitter: EventEmitter<Events>,
  name: EventName,
  options?: { filter?: (event: Events[EventName]) => boolean; signal?: AbortSignal },
): AsyncGenerator<Events[EventName], void, void> {
  let isDone = false
  let pending: Deferred<IteratorResult<Events[EventName], void>> | null = null
  const queue: Array<Events[EventName]> = []

  const unsubscribe = emitter.on(
    name,
    (event) => {
      if (pending == null) {
        queue.push(event)
      } else {
        pending.resolve({ value: event, done: false })
        pending = null
      }
    },
    { filter: options?.filter },
  )

  const stop = () => {
    unsubscribe()
    isDone = true
    if (pending != null) {
      pending.resolve({ done: true, value: undefined })
      pending = null
    }
  }

  if (options?.signal?.aborted) {
    stop()
  } else {
    options?.signal?.addEventListener('abort', () => {
      stop()
    })
  }

  return {
    [Symbol.asyncDispose]() {
      stop()
      return Promise.resolve()
    },
    [Symbol.asyncIterator]() {
      return this
    },
    next: () => {
      if (isDone) {
        return Promise.resolve({ done: true, value: undefined })
      }
      if (queue.length > 0) {
        return Promise.resolve({ value: queue.shift() as Events[EventName], done: false })
      }
      pending = defer<IteratorResult<Events[EventName], void>>()
      return pending.promise
    },
    return: () => {
      stop()
      return Promise.resolve({ done: true, value: undefined })
    },
    throw: (reason: unknown) => {
      stop()
      return Promise.reject(reason)
    },
  }
}

export async function* fromStream<T>(
  stream: ReadableStream<T>,
  options: { preventCancel?: boolean } = {},
): AsyncGenerator<T> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  } finally {
    if (!options.preventCancel) {
      // Early return / break / throw: cancel the source so its cancel()
      // callback runs and resources are released. cancel() on an
      // already-closed stream is a no-op, so normal completion is unaffected.
      await reader.cancel().catch(() => {})
    }
    reader.releaseLock()
  }
}
