import { EventEmitter } from '@enkaku/event'
import { createPipe } from '@enkaku/stream'
import { describe, expect, test } from 'vitest'

import { consume, fromEmitter, fromStream } from '../src/index.js'

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
})
