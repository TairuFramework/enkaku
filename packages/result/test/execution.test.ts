import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  TimeoutInterruption,
} from '@enkaku/async'
import { jest } from '@jest/globals'

import { Execution } from '../src/execution.js'
import { Result } from '../src/result.js'

describe('Execution', () => {
  describe('constructor', () => {
    test('creates an Execution with a simple execute function', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(execution.signal)
    })

    test('creates an Execution with a function returning Result', async () => {
      const execute = jest.fn(() => Promise.resolve(Result.ok('test')))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('creates an Execution with a function returning AsyncResult', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('handles execute function that throws', async () => {
      const error = new Error('execute error')
      const execute = jest.fn(() => Promise.reject(error))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning Result.error', async () => {
      const error = new Error('result error')
      const execute = jest.fn(() => Promise.resolve(Result.error(error)))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })
  })

  describe('constructor with options', () => {
    test('creates Execution with external signal', async () => {
      const externalController = new AbortController()
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { signal: externalController.signal })

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')

      // Aborting external signal should abort execution
      externalController.abort('external abort')
      expect(execution.isAborted).toBe(true)
    })

    test('creates Execution with timeout', async () => {
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('creates Execution with both signal and timeout', async () => {
      const externalController = new AbortController()
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, {
        signal: externalController.signal,
        timeout: 50,
      })

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })
  })

  describe('signal property', () => {
    test('returns the internal AbortSignal', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.signal).toBeInstanceOf(AbortSignal)
      expect(execution.signal.aborted).toBe(false)
    })

    test('signal is aborted after calling abort', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.signal.aborted).toBe(false)
      execution.abort('test abort')
      expect(execution.signal.aborted).toBe(true)
      expect(execution.signal.reason).toBe('test abort')
    })
  })

  describe('isAborted property', () => {
    test('returns false when not aborted', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isAborted).toBe(false)
    })

    test('returns true when aborted', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isAborted).toBe(true)
    })
  })

  describe('isInterrupted property', () => {
    test('returns false when not interrupted', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isInterrupted).toBe(false)
    })

    test('returns true when aborted with AbortInterruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort()
      expect(execution.isInterrupted).toBe(true)
    })

    test('returns true when canceled', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel()
      expect(execution.isInterrupted).toBe(true)
    })

    test('returns true when disposed', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()
      expect(execution.isInterrupted).toBe(true)
    })
  })

  describe('isCanceled property', () => {
    test('returns false when not canceled', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isCanceled).toBe(false)
    })

    test('returns true when canceled', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel()
      expect(execution.isCanceled).toBe(true)
    })

    test('returns false when aborted with non-CancelInterruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isCanceled).toBe(false)
    })
  })

  describe('isDisposed property', () => {
    test('returns false when not disposed', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isDisposed).toBe(false)
    })

    test('returns true when disposed', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()
      expect(execution.isDisposed).toBe(true)
    })

    test('returns false when aborted with non-DisposeInterruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isDisposed).toBe(false)
    })
  })

  describe('isTimedOut property', () => {
    test('returns false when not timed out', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isTimedOut).toBe(false)
    })

    test('returns true when timed out', async () => {
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, { timeout: 50 })

      await execution
      expect(execution.isTimedOut).toBe(true)
    })

    test('returns false when aborted with non-TimeoutInterruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isTimedOut).toBe(false)
    })
  })

  describe('abort method', () => {
    test('aborts the execution with default AbortInterruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort()

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(AbortInterruption)
    })

    test('aborts the execution with custom reason', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('custom reason')

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(false)
      expect(execution.signal.reason).toBe('custom reason')
    })

    test('aborts the execution with existing Interruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)
      const interruption = new AbortInterruption({ cause: 'test' })

      execution.abort(interruption)

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.signal.reason).toBe(interruption)
    })
  })

  describe('cancel method', () => {
    test('cancels the execution with CancelInterruption', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel()

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.isCanceled).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(CancelInterruption)
    })

    test('cancels the execution with custom cause', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel('custom cause')

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.isCanceled).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(CancelInterruption)
      expect(execution.signal.reason.cause).toBe('custom cause')
    })
  })

  describe('Symbol.asyncDispose method', () => {
    test('disposes the execution with DisposeInterruption', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.isDisposed).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(DisposeInterruption)
    })

    test('returns a promise that resolves after disposal', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const disposePromise = execution[Symbol.asyncDispose]()
      expect(disposePromise).toBeInstanceOf(Promise)

      await disposePromise
      expect(execution.isDisposed).toBe(true)
    })
  })

  describe('integration with external signals', () => {
    test('aborts when external signal is aborted', async () => {
      const externalController = new AbortController()
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, { signal: externalController.signal })

      // Abort external signal
      externalController.abort('external abort')

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('aborts when timeout signal is triggered', async () => {
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('aborts when any signal is aborted (signal + timeout)', async () => {
      const externalController = new AbortController()
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, {
        signal: externalController.signal,
        timeout: 50,
      })

      // Abort external signal before timeout
      externalController.abort('external abort')

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
      expect(execution.isTimedOut).toBe(false)
    })
  })

  describe('error handling', () => {
    test('handles execute function throwing synchronous error', async () => {
      const error = new Error('sync error')
      const execute = jest.fn(() => {
        throw error
      })
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning rejected promise', async () => {
      const error = new Error('async error')
      const execute = jest.fn(() => Promise.reject(error))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning Result.error', async () => {
      const error = new Error('result error')
      const execute = jest.fn(() => Promise.resolve(Result.error(error)))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })
  })

  describe('complex scenarios', () => {
    test('handles long-running operation with timeout', async () => {
      const execute = jest.fn(
        (signal: AbortSignal) =>
          new Promise((resolve) => {
            const timeout = setTimeout(() => resolve('success'), 200)
            signal.addEventListener('abort', () => clearTimeout(timeout))
          }),
      )
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('handles operation that completes before timeout', async () => {
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 25)),
      )
      const execution = new Execution(execute, { timeout: 100 })

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('success')
      expect(execution.isTimedOut).toBe(false)
    })

    test('handles multiple abort calls gracefully', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('first abort')
      execution.abort('second abort')
      execution.cancel('cancel')

      expect(execution.isAborted).toBe(true)
      expect(execution.signal.reason).toBe('first abort')
    })
  })
})
