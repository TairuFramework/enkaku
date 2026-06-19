import { EventEmitter } from '@enkaku/event'
import { createPipe } from '@enkaku/stream'
import { describe, expect, test } from 'vitest'

import { consume, fromEmitter, fromStream } from '../src/index.js'

// Rejects if `promise` does not settle within `ms`, so a regression that
// leaves next() parked forever fails fast instead of hanging the suite.
function raceTimeout<T>(promise: Promise<T>, ms = 200): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

describe('consume()', () => {
  test('consumes until the generator ends', async () => {
    async function* generate() {
      yield 1
      yield 2
      yield 3
      return 'done'
    }

    const consumed: Array<number> = []
    const result = await consume(generate(), (value) => {
      consumed.push(value)
    })

    expect(consumed).toEqual([1, 2, 3])
    expect(result).toBe('done')
  })

  test('supports abort signal', async () => {
    async function* generate() {
      yield 1
      yield 2
      yield 3
      return 'done'
    }

    const controller = new AbortController()
    const consumed: Array<number> = []
    await expect(async () => {
      await consume(
        generate(),
        (value) => {
          consumed.push(value)
          if (value === 2) {
            controller.abort('aborted')
          }
        },
        controller.signal,
      )
    }).rejects.toBe('aborted')
    expect(consumed).toEqual([1, 2])
  })

  test('supports return() call', async () => {
    let value = 0
    let returnedValue: string | undefined
    const generator: AsyncGenerator<number, string> = {
      [Symbol.asyncDispose]() {
        return Promise.resolve()
      },
      [Symbol.asyncIterator]() {
        return this
      },
      next: () => {
        return Promise.resolve(
          returnedValue ? { value: returnedValue, done: true } : { value: ++value, done: false },
        )
      },
      return: (what: string) => {
        returnedValue = what
        return Promise.resolve({ value: what, done: true })
      },
      throw: (reason) => Promise.reject(reason),
    }

    const consumed: Array<number> = []
    const result = await consume(generator, (value) => {
      consumed.push(value)
      if (value === 2) {
        generator.return('stop')
      }
    })
    expect(consumed).toEqual([1, 2])
    expect(result).toBe('stop')
  })

  test('supports throw() call', async () => {
    let value = 0
    let rejectReason: string | undefined
    const generator: AsyncGenerator<number, string> = {
      [Symbol.asyncDispose]() {
        return Promise.resolve()
      },
      [Symbol.asyncIterator]() {
        return this
      },
      next: () => {
        return rejectReason
          ? Promise.reject(rejectReason)
          : Promise.resolve({ value: ++value, done: false })
      },
      return: () => {
        return Promise.resolve({ value: 'returned', done: true })
      },
      throw: (reason) => {
        rejectReason = reason
        return Promise.reject(reason)
      },
    }

    const consumed: Array<number> = []
    const reason = { ended: true }
    await expect(() => {
      return consume(generator, (value) => {
        consumed.push(value)
        if (value === 2) {
          generator.throw(reason).catch(() => {
            // catch error to avoid unhandled rejection
          })
        }
      })
    }).rejects.toBe(reason)
    expect(consumed).toEqual([1, 2])
  })

  test('calls iterator.return() (runs finally) on abort', async () => {
    let cleanedUp = false
    async function* generate() {
      try {
        let i = 0
        while (true) {
          yield i++
        }
      } finally {
        cleanedUp = true
      }
    }

    const controller = new AbortController()
    const promise = consume(
      generate(),
      (value) => {
        if (value === 2) controller.abort(new Error('stop'))
      },
      controller.signal,
    )
    await expect(promise).rejects.toThrow('stop')
    // allow the swallowed return() microtask to settle
    await new Promise((resolve) => setImmediate(resolve))
    expect(cleanedUp).toBe(true)
  })

  test('calls iterator.return() on normal completion', async () => {
    let returnCalls = 0
    let callIndex = 0
    const iterator: AsyncIterator<number, string> = {
      next: async () => {
        callIndex++
        if (callIndex === 1) return { done: false, value: 1 }
        return { done: true, value: 'done' }
      },
      return: async () => {
        returnCalls++
        return { done: true, value: 'done' }
      },
    }

    const result = await consume(iterator, () => {})
    await new Promise((resolve) => setImmediate(resolve))
    expect(returnCalls).toBe(1)
    expect(result).toBe('done')
  })

  test('does not call iterator.return() twice when abort races completion', async () => {
    let returnCalls = 0
    const iterator: AsyncIterator<number> = {
      next: async () => ({ done: true, value: undefined }),
      return: async () => {
        returnCalls++
        return { done: true, value: undefined }
      },
    }
    const controller = new AbortController()
    controller.abort(new Error('stop'))
    await expect(consume(iterator, () => {}, controller.signal)).rejects.toThrow('stop')
    await new Promise((resolve) => setImmediate(resolve))
    expect(returnCalls).toBe(1)
  })
})

describe('fromEmitter()', () => {
  test('creates an AsyncIterator from an EventEmitter', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    emitter.emit('test', 1)
    emitter.emit('test', 2)
    emitter.emit('test', 3)

    const values: Array<number> = []
    for await (const value of generator) {
      values.push(value)
      if (value === 2) {
        break
      }
    }
    expect(values).toEqual([1, 2])
  })

  test('supports stopping iteration with a signal', async () => {
    const controller = new AbortController()
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test', { signal: controller.signal })

    emitter.emit('test', 1)
    emitter.emit('test', 2)
    emitter.emit('test', 3)

    const values: Array<number> = []
    for await (const value of generator) {
      values.push(value)
      if (value === 2) {
        controller.abort()
      }
    }
    expect(values).toEqual([1, 2])
  })

  test('supports filtering events', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test', { filter: (value) => value % 2 === 0 })

    emitter.emit('test', 1)
    emitter.emit('test', 2)
    emitter.emit('test', 3)
    emitter.emit('test', 4)

    const values: Array<number> = []
    for await (const value of generator) {
      values.push(value)
      if (value === 4) {
        break
      }
    }
    expect(values).toEqual([2, 4])
  })

  test('supports calling return() on the iterator', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    emitter.emit('test', 1)
    emitter.emit('test', 2)
    emitter.emit('test', 3)

    const values: Array<number> = []
    for await (const value of generator) {
      values.push(value)
      if (value === 2) {
        generator.return()
      }
    }
    expect(values).toEqual([1, 2])
  })

  test('supports calling throw() on the iterator', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    emitter.emit('test', 1)
    emitter.emit('test', 2)
    emitter.emit('test', 3)

    const values: Array<number> = []
    for await (const value of generator) {
      values.push(value)
      if (value === 2) {
        generator.throw('end').catch(() => {
          // catch error to avoid unhandled rejection
        })
      }
    }
    expect(values).toEqual([1, 2])
  })

  test('settles a parked next() with {done:true} on return()', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    // Queue empty: this next() parks on `pending`.
    const parked = generator.next()
    generator.return()

    expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
  })

  test('settles a parked next() with {done:true} on throw()', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    const parked = generator.next()
    // throw()'s own promise rejects with the reason...
    await expect(generator.throw('boom')).rejects.toBe('boom')
    // ...but the parked next() resolves cleanly.
    expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
  })

  test('settles a parked next() with {done:true} on dispose', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    const parked = generator.next()
    await generator[Symbol.asyncDispose]()

    expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
  })

  test('settles a parked next() with {done:true} on signal abort', async () => {
    const controller = new AbortController()
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test', { signal: controller.signal })

    const parked = generator.next()
    controller.abort()

    expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
  })

  test('a raw for await cancelled mid-park terminates cleanly', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test')

    const loop = (async () => {
      // No event is ever emitted; the loop parks immediately then is cancelled.
      for await (const _value of generator) {
        // unreachable
        void _value
      }
    })()

    // Let the loop reach its parked next(), then cancel via the iterator.
    await new Promise((resolve) => setImmediate(resolve))
    await generator.return()

    await expect(raceTimeout(loop)).resolves.toBeUndefined()
  })

  test('settles next() with {done:true} when the signal is already aborted at construction', async () => {
    const controller = new AbortController()
    controller.abort()
    const emitter = new EventEmitter<{ test: number }>()
    const generator = fromEmitter(emitter, 'test', { signal: controller.signal })

    // Signal already aborted before construction: next() must not park.
    expect(await raceTimeout(generator.next())).toEqual({ done: true, value: undefined })
  })

  test('delivers queued null/undefined event values instead of dropping them', async () => {
    const emitter = new EventEmitter<{ test: number | null | undefined }>()
    const generator = fromEmitter(emitter, 'test')

    // Emit BEFORE next(): the value sits in the queue and is drained by next(),
    // exercising the buggy `value != null` guard.
    emitter.emit('test', null)
    expect(await raceTimeout(generator.next())).toEqual({ value: null, done: false })

    emitter.emit('test', undefined)
    expect(await raceTimeout(generator.next())).toEqual({ value: undefined, done: false })
  })
})

describe('fromStream()', () => {
  test('creates an AsyncIterator from a ReadableStream', async () => {
    const { readable, writable } = createPipe<number>()

    const writer = writable.getWriter()
    await writer.write(1)
    await writer.write(2)
    await writer.close()

    const values: Array<number> = []
    for await (const value of fromStream(readable)) {
      values.push(value)
    }
    expect(values).toEqual([1, 2])
  })

  test('supports calling return() on the iterator', async () => {
    const { readable, writable } = createPipe<number>()

    const writer = writable.getWriter()
    await writer.write(1)
    await writer.write(2)

    const iterator = fromStream(readable)
    expect(await iterator.next()).toEqual({ done: false, value: 1 })
    expect(readable.locked).toBe(true)

    await iterator.return(null)
    expect(await iterator.next()).toEqual({ done: true, value: undefined })
    expect(readable.locked).toBe(false)
  })

  test('cancels the source stream on early return', async () => {
    let cancelled = false
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1)
        controller.enqueue(2)
      },
      cancel() {
        cancelled = true
      },
    })

    const iterator = fromStream(stream)
    expect(await iterator.next()).toEqual({ done: false, value: 1 })
    await iterator.return(undefined)

    expect(cancelled).toBe(true)
    expect(stream.locked).toBe(false)
  })

  test('does not cancel the source on early return when preventCancel is set', async () => {
    let cancelled = false
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1)
        controller.enqueue(2)
      },
      cancel() {
        cancelled = true
      },
    })

    const iterator = fromStream(stream, { preventCancel: true })
    expect(await iterator.next()).toEqual({ done: false, value: 1 })
    await iterator.return(undefined)

    expect(cancelled).toBe(false)
    expect(stream.locked).toBe(false)
  })

  test('does not invoke cancel side effects on normal completion', async () => {
    let cancelled = false
    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1)
        controller.enqueue(2)
        controller.close()
      },
      cancel() {
        cancelled = true
      },
    })

    const values: Array<number> = []
    for await (const value of fromStream(stream)) {
      values.push(value)
    }

    expect(values).toEqual([1, 2])
    expect(cancelled).toBe(false)
  })
})
