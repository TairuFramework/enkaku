import { createArraySink } from '@enkaku/stream'

import { EventEmitter } from '../src/index.js'

describe('EventEmitter', () => {
  describe('event streams', () => {
    test('events can be listened to using a readable stream', async () => {
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
