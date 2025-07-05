import { jest } from '@jest/globals'

import { TimeoutInterruption } from '../src/interruptions.js'
import { ScheduledTimeout } from '../src/timeout.js'

describe('ScheduledTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('static methods', () => {
    describe('at()', () => {
      test('creates timeout for specific date', () => {
        const futureDate = new Date(Date.now() + 1000)
        const timeout = ScheduledTimeout.at(futureDate)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        expect(timeout.signal).toBeInstanceOf(AbortSignal)
        expect(timeout.signal.aborted).toBe(false)
      })

      test('creates timeout with options', () => {
        const futureDate = new Date(Date.now() + 1000)
        const options = { message: 'Custom timeout message' }
        const timeout = ScheduledTimeout.at(futureDate, options)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        expect(timeout.signal.aborted).toBe(false)
      })

      test('handles past date', () => {
        const pastDate = new Date(Date.now() - 1000)
        const timeout = ScheduledTimeout.at(pastDate)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        // Should abort after the timeout fires (immediately for past dates)
        expect(timeout.signal.aborted).toBe(false)

        jest.advanceTimersByTime(1)
        expect(timeout.signal.aborted).toBe(true)
      })
    })

    describe('in()', () => {
      test('creates timeout with delay', () => {
        const timeout = ScheduledTimeout.in(1000)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        expect(timeout.signal).toBeInstanceOf(AbortSignal)
        expect(timeout.signal.aborted).toBe(false)
      })

      test('creates timeout with delay and options', () => {
        const options = { message: 'Custom timeout message' }
        const timeout = ScheduledTimeout.in(1000, options)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        expect(timeout.signal.aborted).toBe(false)
      })

      test('handles zero delay', () => {
        const timeout = ScheduledTimeout.in(0)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        // Should abort after the timeout fires (immediately for zero delay)
        expect(timeout.signal.aborted).toBe(false)

        jest.advanceTimersByTime(1)
        expect(timeout.signal.aborted).toBe(true)
      })

      test('handles negative delay', () => {
        const timeout = ScheduledTimeout.in(-1000)

        expect(timeout).toBeInstanceOf(ScheduledTimeout)
        // Should abort after the timeout fires (immediately for negative delay)
        expect(timeout.signal.aborted).toBe(false)

        jest.advanceTimersByTime(1)
        expect(timeout.signal.aborted).toBe(true)
      })
    })
  })

  describe('constructor', () => {
    test('creates timeout with delay', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      expect(timeout).toBeInstanceOf(ScheduledTimeout)
      expect(timeout.signal).toBeInstanceOf(AbortSignal)
      expect(timeout.signal.aborted).toBe(false)
    })

    test('creates timeout with delay and options', () => {
      const options = { message: 'Custom timeout message' }
      const timeout = new ScheduledTimeout({ delay: 1000, ...options })

      expect(timeout).toBeInstanceOf(ScheduledTimeout)
      expect(timeout.signal.aborted).toBe(false)
    })
  })

  describe('signal', () => {
    test('returns abort signal', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      expect(timeout.signal).toBeInstanceOf(AbortSignal)
      expect(timeout.signal.aborted).toBe(false)
    })

    test('signal becomes aborted after timeout', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      expect(timeout.signal.aborted).toBe(false)

      jest.advanceTimersByTime(1000)

      expect(timeout.signal.aborted).toBe(true)
    })
  })

  describe('cancel()', () => {
    test('cancels the timeout', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      timeout.cancel()

      jest.advanceTimersByTime(1000)

      expect(timeout.signal.aborted).toBe(false)
    })

    test('can be called multiple times safely', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      timeout.cancel()
      timeout.cancel()

      jest.advanceTimersByTime(1000)

      expect(timeout.signal.aborted).toBe(false)
    })
  })

  describe('disposal', () => {
    test('implements Disposable interface', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      expect(typeof timeout[Symbol.dispose]).toBe('function')
    })

    test('cancels timeout when disposed', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      timeout[Symbol.dispose]()

      jest.advanceTimersByTime(1000)

      expect(timeout.signal.aborted).toBe(false)
    })

    test('can be used with using statement', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })

      // Simulate using statement behavior
      timeout[Symbol.dispose]()

      jest.advanceTimersByTime(1000)

      expect(timeout.signal.aborted).toBe(false)
    })
  })

  describe('timeout interruption', () => {
    test('aborts with TimeoutInterruption', () => {
      const timeout = new ScheduledTimeout({ delay: 1000 })
      const callback = jest.fn()

      timeout.signal.addEventListener('abort', () => {
        expect(timeout.signal.reason).toBeInstanceOf(TimeoutInterruption)
        expect(timeout.signal.reason.message).toBe('Timeout after 1000ms')
        callback()
      })

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    test('aborts with custom message', () => {
      const options = { message: 'Custom timeout message' }
      const timeout = new ScheduledTimeout({ delay: 1000, ...options })
      const callback = jest.fn()

      timeout.signal.addEventListener('abort', () => {
        expect(timeout.signal.reason).toBeInstanceOf(TimeoutInterruption)
        expect(timeout.signal.reason.message).toBe('Custom timeout message')
        callback()
      })

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    test('aborts with custom cause', () => {
      const cause = new Error('Original error')
      const options = { cause }
      const timeout = new ScheduledTimeout({ delay: 1000, ...options })
      const callback = jest.fn()

      timeout.signal.addEventListener('abort', () => {
        expect(timeout.signal.reason).toBeInstanceOf(TimeoutInterruption)
        expect(timeout.signal.reason.cause).toBe(cause)
        callback()
      })

      jest.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    test('handles very large delay', () => {
      const timeout = new ScheduledTimeout({ delay: Number.MAX_SAFE_INTEGER })

      expect(timeout.signal.aborted).toBe(false)
    })

    test('handles very small delay', () => {
      const timeout = new ScheduledTimeout({ delay: 1 })

      expect(timeout.signal.aborted).toBe(false)

      jest.advanceTimersByTime(1)

      expect(timeout.signal.aborted).toBe(true)
    })
  })
})
