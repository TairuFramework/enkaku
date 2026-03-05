import { createArraySink } from '@enkaku/stream'
import { describe, expect, test } from 'vitest'

import { EventEmitter } from '../src/index.js'

describe('EventEmitter', () => {
  test('events can be listened to using a filter', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const items: Array<number> = []

    emitter.on(
      'test',
      (value) => {
        items.push(value)
      },
      { filter: (value) => value % 2 === 0 },
    )

    await emitter.emit('test', 1)
    await emitter.emit('test', 2)
    await emitter.emit('test', 3)
    await emitter.emit('test', 4)

    expect(items).toEqual([2, 4])
  })

  test('on() listener receives raw data, not envelope', async () => {
    const emitter = new EventEmitter<{ test: string }>()
    const received: Array<string> = []

    emitter.on('test', (value) => {
      received.push(value)
    })

    await emitter.emit('test', 'hello')
    await emitter.emit('test', 'world')

    expect(received).toEqual(['hello', 'world'])
  })

  test('on() filter receives raw data', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const filterArgs: Array<number> = []

    emitter.on('test', () => {}, {
      filter: (value) => {
        filterArgs.push(value)
        return true
      },
    })

    await emitter.emit('test', 42)
    expect(filterArgs).toEqual([42])
  })

  test('once() promise form resolves with raw data', async () => {
    const emitter = new EventEmitter<{ test: string }>()

    const promise = emitter.once('test')
    await emitter.emit('test', 'hello')

    const result = await promise
    expect(result).toBe('hello')
  })

  test('once() with filter resolves with first matching event', async () => {
    const emitter = new EventEmitter<{ test: number }>()

    const promise = emitter.once('test', { filter: (value) => value % 2 === 0 })
    await emitter.emit('test', 1)
    await emitter.emit('test', 3)
    await emitter.emit('test', 4)

    const result = await promise
    expect(result).toBe(4)
  })

  test('emit() waits for async listeners to resolve', async () => {
    const emitter = new EventEmitter<{ test: string }>()
    const order: Array<string> = []

    emitter.on('test', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      order.push('listener done')
    })

    await emitter.emit('test', 'hello')
    order.push('emit done')

    expect(order).toEqual(['listener done', 'emit done'])
  })

  test('emit() propagates sync listener errors', async () => {
    const emitter = new EventEmitter<{ test: string }>()

    emitter.on('test', () => {
      throw new Error('sync error')
    })

    await expect(emitter.emit('test', 'hello')).rejects.toThrow('sync error')
  })

  test('emit() propagates async listener errors', async () => {
    const emitter = new EventEmitter<{ test: string }>()

    emitter.on('test', async () => {
      throw new Error('async error')
    })

    await expect(emitter.emit('test', 'hello')).rejects.toThrow('async error')
  })

  test('emit() propagates errors from filtered listeners', async () => {
    const emitter = new EventEmitter<{ test: number }>()

    emitter.on(
      'test',
      () => {
        throw new Error('filtered error')
      },
      { filter: (value) => value > 0 },
    )

    // Should not throw when filter rejects
    await emitter.emit('test', -1)
    // Should throw when filter matches and listener throws
    await expect(emitter.emit('test', 1)).rejects.toThrow('filtered error')
  })

  test('emit() runs multiple listeners in parallel', async () => {
    const emitter = new EventEmitter<{ test: string }>()
    const order: Array<string> = []

    emitter.on('test', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      order.push('slow')
    })
    emitter.on('test', async () => {
      order.push('fast')
    })

    await emitter.emit('test', 'hello')
    // If parallel, 'fast' finishes before 'slow'
    expect(order).toEqual(['fast', 'slow'])
  })

  test('emit() aggregates errors from multiple listeners', async () => {
    const emitter = new EventEmitter<{ test: string }>()

    emitter.on('test', () => {
      throw new Error('error 1')
    })
    emitter.on('test', () => {
      throw new Error('error 2')
    })

    await expect(emitter.emit('test', 'hello')).rejects.toThrow(AggregateError)
    try {
      await emitter.emit('test', 'hello')
    } catch (err) {
      expect(err).toBeInstanceOf(AggregateError)
      expect((err as AggregateError).errors).toHaveLength(2)
      expect((err as AggregateError).errors[0]).toEqual(new Error('error 1'))
      expect((err as AggregateError).errors[1]).toEqual(new Error('error 2'))
    }
  })

  test('on() unsubscribes when signal is aborted', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const controller = new AbortController()
    const received: Array<number> = []

    emitter.on('test', (value) => received.push(value), { signal: controller.signal })

    await emitter.emit('test', 1)
    controller.abort()
    await emitter.emit('test', 2)

    expect(received).toEqual([1])
  })

  test('on() with already-aborted signal never fires', async () => {
    const emitter = new EventEmitter<{ test: number }>()
    const received: Array<number> = []

    emitter.on('test', (value) => received.push(value), { signal: AbortSignal.abort() })

    await emitter.emit('test', 1)
    expect(received).toEqual([])
  })

  test('once() rejects when aborted via signal', async () => {
    const emitter = new EventEmitter<{ test: string }>()
    const controller = new AbortController()

    const promise = emitter.once('test', { signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toThrow()
  })

  test('once() with already-aborted signal rejects immediately', async () => {
    const emitter = new EventEmitter<{ test: string }>()

    const promise = emitter.once('test', { signal: AbortSignal.abort() })
    await expect(promise).rejects.toThrow()
  })

  describe('event streams', () => {
    test('readable() with pre-aborted signal closes immediately', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const reader = emitter.readable('test', { signal: AbortSignal.abort() }).getReader()

      const result = await reader.read()
      expect(result).toEqual({ done: true, value: undefined })
    })

    test('events can be listened to using a readable stream', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const controller = new AbortController()
      const [writable, items] = createArraySink<number>()

      const readable = emitter.readable('test', {
        filter: (value) => value % 2 === 0,
        signal: controller.signal,
      })
      readable.pipeTo(writable)
      await emitter.emit('test', 1)
      await emitter.emit('test', 2)
      await emitter.emit('test', 3)

      controller.abort()
      await emitter.emit('test', 4)
      await expect(items).resolves.toEqual([2])
    })

    test('events can be listened to using a filter', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const controller = new AbortController()
      const [writable, items] = createArraySink<number>()

      const readable = emitter.readable('test', { signal: controller.signal })
      readable.pipeTo(writable)
      await emitter.emit('test', 1)
      await emitter.emit('test', 2)
      await emitter.emit('test', 3)

      controller.abort()
      await emitter.emit('test', 4)
      await expect(items).resolves.toEqual([1, 2, 3])
    })

    test('events readable stream can be cancelled', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const reader = emitter.readable('test').getReader()
      await emitter.emit('test', 1)
      await emitter.emit('test', 2)
      await emitter.emit('test', 3)

      await expect(reader.read()).resolves.toEqual({ done: false, value: 1 })
      await expect(reader.read()).resolves.toEqual({ done: false, value: 2 })

      await reader.cancel()
      await emitter.emit('test', 4)
      await expect(reader.closed).resolves.toBeUndefined()
    })

    test('events can be emitted using a writable stream', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const controller = new AbortController()
      const [sink, items] = createArraySink<number>()

      const readable = emitter.readable('test', { signal: controller.signal })
      readable.pipeTo(sink)

      const writer = emitter.writable('test').getWriter()
      await writer.write(1)
      await writer.write(2)
      await writer.write(3)

      controller.abort()
      await writer.write(4)
      await expect(items).resolves.toEqual([1, 2, 3])
    })

    test('events can be piped between emitters', async () => {
      const emitter1 = new EventEmitter<{ test: number }>()
      const emitter2 = new EventEmitter<{ test: number }>()
      const controller = new AbortController()
      const [sink, items] = createArraySink<number>()

      const readable = emitter2.readable('test', { signal: controller.signal })
      readable.pipeTo(sink)
      emitter1.readable('test').pipeTo(emitter2.writable('test'))

      const writer = emitter1.writable('test').getWriter()
      await writer.write(1)
      await writer.write(2)
      await writer.write(3)

      controller.abort()
      await writer.write(4)
      await expect(items).resolves.toEqual([1, 2, 3])
    })

    test('events piped between emitters can be aborted from the first emitter', async () => {
      const emitter1 = new EventEmitter<{ foo: number }>()
      const emitter2 = new EventEmitter<{ bar: number }>()
      const controller1 = new AbortController()
      const controller2 = new AbortController()
      const [sink, items] = createArraySink<number>()

      const readable = emitter2.readable('bar', { signal: controller2.signal })
      readable.pipeTo(sink)
      // Pipe events from emitter1 to emitter2
      emitter1.readable('foo', { signal: controller1.signal }).pipeTo(emitter2.writable('bar'))

      const writer = emitter1.writable('foo').getWriter()
      await writer.write(1)
      await writer.write(2)
      // Abort the first listener before writing a third value, it shouldn't be present in the sink
      controller1.abort()
      await writer.write(3)
      // Abort the second listener to close the stream
      controller2.abort()
      await writer.write(4)
      await expect(items).resolves.toEqual([1, 2])
    })
  })
})
