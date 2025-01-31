import { createArraySink } from '@enkaku/stream'
import { jest } from '@jest/globals'

import { EventEmitter } from '../src/index.js'

describe('EventEmitter', () => {
  describe('core functionalities', () => {
    test('adds and removes listener using dedicated methods', () => {
      const emitter = new EventEmitter<{ test: number }>()
      const listener = jest.fn()

      emitter.on('test', listener)
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      expect(listener).toHaveBeenCalledTimes(2)

      const emitted = listener.mock.calls[0][0]
      expect(emitted).toBeInstanceOf(CustomEvent)
      expect((emitted as CustomEvent).detail).toBe(1)

      emitter.off('test', listener)
      emitter.emit('test', 3)
      expect(listener).toHaveBeenCalledTimes(2)
    })

    test('removes listener using returned function', () => {
      const emitter = new EventEmitter<{ test: number }>()
      const listener = jest.fn()

      const remove = emitter.on('test', listener)
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      expect(listener).toHaveBeenCalledTimes(2)

      remove()
      emitter.emit('test', 3)
      expect(listener).toHaveBeenCalledTimes(2)
    })

    test('removes listener using abort signal', () => {
      const emitter = new EventEmitter<{ test: number }>()
      const listener = jest.fn()
      const controller = new AbortController()

      emitter.on('test', listener, { signal: controller.signal })
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      expect(listener).toHaveBeenCalledTimes(2)

      controller.abort()
      emitter.emit('test', 3)
      expect(listener).toHaveBeenCalledTimes(2)
    })

    test('does not trigger listener if signal is aborted', () => {
      const emitter = new EventEmitter<{ test: number }>()
      const listener = jest.fn()

      emitter.on('test', listener, { signal: AbortSignal.abort() })
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('single event handling', () => {
    test('once() only triggers the listener once', () => {
      const emitter = new EventEmitter<{ test: number }>()
      const listener = jest.fn()

      emitter.once('test', listener)
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    test('removes listener using returned function', () => {
      const emitter = new EventEmitter<{ test: number }>()
      const listener = jest.fn()

      const remove = emitter.once('test', listener)
      remove()
      emitter.emit('test', 1)
      expect(listener).not.toHaveBeenCalled()
    })

    test('next() resolves with the next event', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const next = new Promise((resolve) => {
        emitter.next('test').then(resolve)
        emitter.emit('test', 1)
      })
      await expect(next).resolves.toBe(1)
    })

    test('next() rejects on abort signal', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const controller = new AbortController()

      const next = new Promise((resolve, reject) => {
        emitter.next('test', { signal: controller.signal }).then(resolve, reject)
        controller.abort()
      })

      await expect(next).rejects.toBeInstanceOf(DOMException)
    })

    test('next() rejects on abort signal with a custom reason', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const controller = new AbortController()

      const next = new Promise((resolve, reject) => {
        emitter.next('test', { signal: controller.signal }).then(resolve, reject)
        controller.abort('foo')
      })

      await expect(next).rejects.toBe('foo')
    })

    test('next() rejects immediately if the signal is already aborted', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const next = new Promise((resolve, reject) => {
        emitter.next('test', { signal: AbortSignal.abort('done') }).then(resolve, reject)
        emitter.emit('test', 1)
      })
      await expect(next).rejects.toBe('done')
    })
  })

  describe('event streams', () => {
    test('events can be listened to using a readable stream', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const controller = new AbortController()
      const [writable, items] = createArraySink<number>()

      const readable = emitter.readable('test', { signal: controller.signal })
      readable.pipeTo(writable)
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      emitter.emit('test', 3)

      controller.abort()
      emitter.emit('test', 4)
      await expect(items).resolves.toEqual([1, 2, 3])
    })

    test('events readable stream can be cancelled', async () => {
      const emitter = new EventEmitter<{ test: number }>()
      const reader = emitter.readable('test').getReader()
      emitter.emit('test', 1)
      emitter.emit('test', 2)
      emitter.emit('test', 3)

      await expect(reader.read()).resolves.toEqual({ done: false, value: 1 })
      await expect(reader.read()).resolves.toEqual({ done: false, value: 2 })

      await reader.cancel()
      emitter.emit('test', 4)
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
