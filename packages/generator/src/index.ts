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
  let aborted = false
  const ended = defer<TReturn>()

  signal?.addEventListener('abort', () => {
    aborted = true
    ended.reject(signal.reason)
  })

  async function pull() {
    try {
      const { done, value } = await iterator.next()
      if (aborted || done) {
        if (done) {
          ended.resolve(value)
        }
        return
      }

      await callback(value)
      void pull()
    } catch (reason) {
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
  signal?: AbortSignal,
): AsyncGenerator<Events[EventName], void, void> {
  let isDone = false
  let pending: Deferred<Events[EventName]> | null = null
  const queue: Array<Events[EventName]> = []

  const unsubscribe = emitter.on(name, (event) => {
    if (pending == null) {
      queue.push(event)
    } else {
      pending.resolve(event)
      pending = null
    }
  })

  const stop = () => {
    unsubscribe()
    isDone = true
  }

  signal?.addEventListener('abort', () => {
    stop()
  })

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
      const value = queue.shift()
      if (value != null) {
        return Promise.resolve({ value, done: false })
      }
      pending = defer<Events[EventName]>()
      return pending.promise.then((value) => ({ value, done: false }))
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

export async function* fromStream<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
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
    reader.releaseLock()
  }
}
