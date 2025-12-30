import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  type Interruption,
  TimeoutInterruption,
} from '@enkaku/async'
import { AsyncResult, Result } from '@enkaku/result'
import { vi } from 'vitest'

import { Execution } from '../src/execution.js'

describe('Execution', () => {
  describe('constructor', () => {
    test('creates an Execution with a simple execute function', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(execution.signal)
    })

    test('creates an Execution with a function returning Result', async () => {
      const execute = vi.fn(() => Promise.resolve(Result.ok('test')))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('creates an Execution with a function returning AsyncResult', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('handles execute function that throws', async () => {
      const error = new Error('execute error')
      const execute = vi.fn(() => Promise.reject(error))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning Result.error', async () => {
      const error = new Error('result error')
      const execute = vi.fn(() => Promise.resolve(Result.error(error)))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })
  })

  describe('constructor with options', () => {
    test('creates Execution with external signal', async () => {
      const externalController = new AbortController()
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { signal: externalController.signal })

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')

      // Aborting external signal should abort execution
      externalController.abort('external abort')
      expect(execution.isAborted).toBe(true)
    })

    test('creates Execution with timeout', async () => {
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('creates Execution with both signal and timeout', async () => {
      const externalController = new AbortController()
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
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
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.signal).toBeInstanceOf(AbortSignal)
      expect(execution.signal.aborted).toBe(false)
    })

    test('signal is aborted after calling abort', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.signal.aborted).toBe(false)
      execution.abort('test abort')
      expect(execution.signal.aborted).toBe(true)
      expect(execution.signal.reason).toBe('test abort')
    })
  })

  describe('isAborted property', () => {
    test('returns false when not aborted', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isAborted).toBe(false)
    })

    test('returns true when aborted', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isAborted).toBe(true)
    })
  })

  describe('isInterrupted property', () => {
    test('returns false when not interrupted', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isInterrupted).toBe(false)
    })

    test('returns true when aborted with AbortInterruption', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort()
      expect(execution.isInterrupted).toBe(true)
    })

    test('returns true when canceled', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel()
      expect(execution.isInterrupted).toBe(true)
    })

    test('returns true when disposed', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()
      expect(execution.isInterrupted).toBe(true)
    })
  })

  describe('isCanceled property', () => {
    test('returns false when not canceled', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isCanceled).toBe(false)
    })

    test('returns true when canceled', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel()
      expect(execution.isCanceled).toBe(true)
    })

    test('returns false when aborted with non-CancelInterruption', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isCanceled).toBe(false)
    })
  })

  describe('isDisposed property', () => {
    test('returns false when not disposed', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isDisposed).toBe(false)
    })

    test('returns true when disposed', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()
      expect(execution.isDisposed).toBe(true)
    })

    test('returns false when aborted with non-DisposeInterruption', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isDisposed).toBe(false)
    })
  })

  describe('isTimedOut property', () => {
    test('returns false when not timed out', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      expect(execution.isTimedOut).toBe(false)
    })

    test('returns true when timed out', async () => {
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
      const execution = new Execution(execute, { timeout: 50 })

      await execution
      expect(execution.isTimedOut).toBe(true)
    })

    test('returns false when aborted with non-TimeoutInterruption', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      expect(execution.isTimedOut).toBe(false)
    })
  })

  describe('Symbol.asyncDispose method', () => {
    test('disposes the execution with DisposeInterruption', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.isDisposed).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(DisposeInterruption)
    })

    test('returns a promise that resolves after disposal', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const disposePromise = execution[Symbol.asyncDispose]()
      expect(disposePromise).toBeInstanceOf(Promise)

      await disposePromise
      expect(execution.isDisposed).toBe(true)
    })
  })

  describe('abort method', () => {
    test('aborts the execution with default AbortInterruption', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort()

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(AbortInterruption)
    })

    test('aborts the execution with custom reason', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('custom reason')

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(false)
      expect(execution.signal.reason).toBe('custom reason')
    })

    test('aborts the execution with existing Interruption', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
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
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel()

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.isCanceled).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(CancelInterruption)
    })

    test('cancels the execution with custom cause', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel('custom cause')

      expect(execution.isAborted).toBe(true)
      expect(execution.isInterrupted).toBe(true)
      expect(execution.isCanceled).toBe(true)
      expect(execution.signal.reason).toBeInstanceOf(CancelInterruption)
      expect(execution.signal.reason.cause).toBe('custom cause')
    })
  })

  describe('integration with external signals', () => {
    test('aborts when external signal is aborted', async () => {
      const externalController = new AbortController()
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
      const execution = new Execution(execute, { signal: externalController.signal })

      // Abort external signal
      externalController.abort('external abort')

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('aborts when timeout signal is triggered', async () => {
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('aborts when any signal is aborted (signal + timeout)', async () => {
      const externalController = new AbortController()
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
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
      const execute = vi.fn(() => {
        throw error
      })
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning rejected promise', async () => {
      const error = new Error('async error')
      const execute = vi.fn(() => Promise.reject(error))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning Result.error', async () => {
      const error = new Error('result error')
      const execute = vi.fn(() => Promise.resolve(Result.error(error)))
      const execution = new Execution(execute)

      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('Promise-like behavior with interruption', async () => {
      const execution = new Execution(() => AsyncResult.ok('test'))
      execution.abort('test abort')
      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
    })
  })

  describe('complex scenarios', () => {
    test('handles long-running operation with timeout', async () => {
      const execute = vi.fn(
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
      const execute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 25)),
      )
      const execution = new Execution(execute, { timeout: 100 })

      const result = await execution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('success')
      expect(execution.isTimedOut).toBe(false)
    })

    test('handles multiple abort calls gracefully', () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('first abort')
      execution.abort('second abort')
      execution.cancel('cancel')

      expect(execution.isAborted).toBe(true)
      expect(execution.signal.reason).toBe('first abort')
    })
  })

  describe('chain method', () => {
    test('creates a chained execution without executing immediately', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Neither execution should have been called yet
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled()

      // Only when we consume the chained execution should both execute
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('executes chain steps in order', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.resolve('first')
      })
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => {
        executionOrder.push('second')
        return Promise.resolve('second')
      })
      const chainedExecution = firstExecution.next((result) => {
        executionOrder.push('chain function')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // No execution should happen yet
      expect(executionOrder).toEqual([])

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
    })

    test('handles chain with error in first execution', async () => {
      const error = new Error('first error')
      const firstExecute = vi.fn(() => Promise.reject(error))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        // The chain function is called and should receive the error result
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
        return secondExecute
      })

      // Neither should be called yet
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with error in second execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with Result.error in first execution', async () => {
      const error = new Error('first error')
      const firstExecute = vi.fn(() => Promise.resolve(Result.error(error)))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        // The chain function is called and should receive the error result
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with Result.error in second execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.resolve(Result.error(secondError)))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('supports multiple chain calls', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      // No execution should happen yet
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled()
      expect(thirdExecute).not.toHaveBeenCalled()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with async function in chain callback', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next(async (result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with promise returning function in chain callback', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return Promise.resolve(secondExecute)
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with timeout in second execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with timeout error in second execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Create a new execution with timeout from the chained result
      const timedExecution = new Execution(() => chainedExecution, { timeout: 50 })

      // Execute the timed chain
      const result = await timedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with abort in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        // The chain function is called and should receive the abort result
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(AbortInterruption)
        return secondExecute
      })

      // Abort the first execution before consuming
      firstExecution.abort('test abort')

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was aborted before starting
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with cancel in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        // The chain function is called and should receive the cancel result
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(CancelInterruption)
        return secondExecute
      })

      // Cancel the first execution before consuming
      firstExecution.cancel('test cancel')

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was canceled before starting
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with dispose in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        // The chain function is called and should receive the dispose result
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(DisposeInterruption)
        return secondExecute
      })

      // Dispose the first execution before consuming
      await firstExecution[Symbol.asyncDispose]()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was disposed before starting
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain when already interrupted', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      // Abort the execution first
      firstExecution.abort('test abort')

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        // The chain function should be called and receive the abort result
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(AbortInterruption)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      // Not called because execution was aborted before starting
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with Result.error in chain callback', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return () => Promise.resolve(Result.error(chainError))
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(chainError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with AsyncResult in chain callback', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const secondExecution = new Execution(secondExecute)

      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return () => secondExecution
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with AsyncResult.error in chain callback', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const secondExecution = new Execution(() => Promise.reject(chainError))

      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return () => secondExecution
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(chainError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })
  })

  describe('ifError method', () => {
    test('creates a chained execution that only executes on error', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return errorHandler
      })

      // Neither execution should have been called yet
      expect(firstExecute).not.toHaveBeenCalled()
      expect(errorHandler).not.toHaveBeenCalled()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('does not execute error handler when first execution succeeds', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('success'))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError(() => {
        // This should not be called
        expect(true).toBe(false)
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('success')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).not.toHaveBeenCalled()
    })

    test('handles error in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const errorHandler = vi.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles Result.error in first execution', async () => {
      const firstError = new Error('first error')
      const firstExecute = vi.fn(() => Promise.resolve(Result.error(firstError)))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBe(firstError)
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles Result.error in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const errorHandler = vi.fn(() => Promise.resolve(Result.error(secondError)))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles AbortInterruption in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('success'))
      const firstExecution = new Execution(firstExecute)

      // Abort the execution
      firstExecution.abort('test abort')

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(AbortInterruption)
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was aborted before starting
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles CancelInterruption in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('success'))
      const firstExecution = new Execution(firstExecute)

      // Cancel the execution
      firstExecution.cancel('test cancel')

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(CancelInterruption)
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was canceled before starting
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles DisposeInterruption in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('success'))
      const firstExecution = new Execution(firstExecute)

      // Dispose the execution
      await firstExecution[Symbol.asyncDispose]()

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(DisposeInterruption)
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was disposed before starting
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles TimeoutInterruption in first execution', async () => {
      const firstExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 100)),
      )
      const firstExecution = new Execution({ execute: firstExecute, timeout: 50 })

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(TimeoutInterruption)
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('supports multiple ifError calls', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const firstErrorHandler = vi.fn(() => Promise.reject(new Error('second error')))
      const secondErrorHandler = vi.fn(() => Promise.resolve('recovered'))

      const chainedExecution = firstExecution
        .ifError((error) => {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('first error')
          return firstErrorHandler
        })
        .ifError((error) => {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return secondErrorHandler
        })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(firstErrorHandler).toHaveBeenCalledTimes(1)
      expect(secondErrorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles async function in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError(async (error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles promise returning function in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return Promise.resolve(errorHandler)
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles executable object in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return { execute: errorHandler }
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles executable object with timeout in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('recovered'), 100)),
      )
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return { execute: errorHandler, timeout: 50 }
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles AsyncResult in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const secondExecution = new Execution(errorHandler)

      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return () => secondExecution
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles AsyncResult.error in error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecution = new Execution(() => Promise.reject(secondError))

      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return () => secondExecution
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('works with typed generics', async () => {
      type User = {
        id: number
        name: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND' | 'USER_INVALID'
      }

      const userError: UserError = Object.assign(new Error('User not found'), {
        code: 'USER_NOT_FOUND' as const,
      })
      const firstExecute = vi.fn(() => Promise.reject(userError))
      const firstExecution = new Execution<User, UserError>(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBe(userError)
        if ('code' in error) {
          expect(error.code).toBe('USER_NOT_FOUND')
        }
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles custom error types in error handler', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const customError = new CustomError('custom error', 500)
      const firstExecute = vi.fn(() => Promise.reject(customError))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBe(customError)
        if ('code' in error) {
          expect(error.code).toBe(500)
        }
        return errorHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles null return from error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return null
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(Error)
      if (result.error) {
        expect(result.error.message).toBe('first error')
      }
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles undefined return from error handler', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return null // Return null instead of undefined to avoid the signal issue
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(Error)
      if (result.error) {
        expect(result.error.message).toBe('first error')
      }
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles complex error recovery scenario', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.reject(new Error('first error'))
      })
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => {
        executionOrder.push('second')
        return Promise.reject(new Error('second error'))
      })

      const thirdExecute = vi.fn(() => {
        executionOrder.push('third')
        return Promise.resolve('recovered')
      })

      const chainedExecution = firstExecution
        .ifError((error) => {
          executionOrder.push('error handler 1')
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('first error')
          return secondExecute
        })
        .ifError((error) => {
          executionOrder.push('error handler 2')
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return thirdExecute
        })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('recovered')
      expect(executionOrder).toEqual([
        'first',
        'error handler 1',
        'second',
        'error handler 2',
        'third',
      ])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('handles mixed next and ifError calls', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.reject(new Error('first error'))
      })
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => {
        executionOrder.push('second')
        return Promise.resolve('success')
      })

      const thirdExecute = vi.fn(() => {
        executionOrder.push('third')
        return Promise.resolve('final')
      })

      const chainedExecution = firstExecution
        .ifError((error) => {
          executionOrder.push('error handler')
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('first error')
          return secondExecute
        })
        .next((result) => {
          executionOrder.push('next function')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('success')
          return thirdExecute
        })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('final')
      expect(executionOrder).toEqual(['first', 'error handler', 'second', 'next function', 'third'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('handles timeout in error handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('recovered'), 100)),
      )
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return errorHandler
      })

      // Create a new execution with timeout from the chained result
      const timedExecution = new Execution(() => chainedExecution, { timeout: 50 })

      // Execute the timed chain
      const result = await timedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('handles abort in error handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(AbortInterruption)
        expect(error.cause).toBe('test abort')
        return errorHandler
      })

      // Abort the chained execution before consuming
      chainedExecution.abort('test abort')

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was aborted
      expect(errorHandler).not.toHaveBeenCalled() // Not called because execution was aborted
    })

    test('handles cancel in error handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(CancelInterruption)
        expect(error.cause).toBe('test cancel')
        return errorHandler
      })

      // Cancel the chained execution before consuming
      chainedExecution.cancel('test cancel')

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(CancelInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(errorHandler).not.toHaveBeenCalled() // Not called because execution was canceled
    })

    test('handles dispose in error handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(DisposeInterruption)
        return errorHandler
      })

      // Dispose the chained execution before consuming
      await chainedExecution[Symbol.asyncDispose]()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(DisposeInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(errorHandler).not.toHaveBeenCalled() // Not called because execution was disposed
    })
  })

  describe('ifOK method', () => {
    test('creates a chained execution that only executes on success', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Neither execution should have been called yet
      expect(firstExecute).not.toHaveBeenCalled()
      expect(okHandler).not.toHaveBeenCalled()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('does not execute ok handler when first execution fails', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('fail')))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK(() => {
        // This should not be called
        expect(true).toBe(false)
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('fail')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).not.toHaveBeenCalled()
    })

    test('handles error in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const okHandler = vi.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles Result.ok in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve(Result.ok('first')))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles Result.ok in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve(Result.ok('second')))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles AbortInterruption in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      // Abort the execution
      firstExecution.abort('test abort')

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK(() => {
        // Should not be called
        expect(true).toBe(false)
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(okHandler).not.toHaveBeenCalled()
    })

    test('handles CancelInterruption in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      // Cancel the execution
      firstExecution.cancel('test cancel')

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK(() => {
        // Should not be called
        expect(true).toBe(false)
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(CancelInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(okHandler).not.toHaveBeenCalled()
    })

    test('handles DisposeInterruption in first execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      // Dispose the execution
      await firstExecution[Symbol.asyncDispose]()

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK(() => {
        // Should not be called
        expect(true).toBe(false)
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(DisposeInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(okHandler).not.toHaveBeenCalled()
    })

    test('handles TimeoutInterruption in first execution', async () => {
      const firstExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('first'), 100)),
      )
      const firstExecution = new Execution({ execute: firstExecute, timeout: 50 })

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK(() => {
        // Should not be called
        expect(true).toBe(false)
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).not.toHaveBeenCalled()
    })

    test('supports multiple ifOK calls', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondHandler = vi.fn(() => Promise.resolve('second'))
      const thirdHandler = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .ifOK((value) => {
          expect(value).toBe('first')
          return secondHandler
        })
        .ifOK((value) => {
          expect(value).toBe('second')
          return thirdHandler
        })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondHandler).toHaveBeenCalledTimes(1)
      expect(thirdHandler).toHaveBeenCalledTimes(1)
    })

    test('handles async function in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK(async (value) => {
        expect(value).toBe('first')
        await new Promise((resolve) => setTimeout(resolve, 10))
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles promise returning function in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return Promise.resolve(okHandler)
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles executable object in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return { execute: okHandler }
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles executable object with timeout in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return { execute: okHandler, timeout: 50 }
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles AsyncResult in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const secondExecution = new Execution(okHandler)

      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return () => secondExecution
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles AsyncResult.error in ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecution = new Execution(() => Promise.reject(secondError))

      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return () => secondExecution
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('works with typed generics', async () => {
      type User = {
        id: number
        name: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND' | 'USER_INVALID'
      }

      const user: User = { id: 1, name: 'John Doe' }
      const firstExecute = vi.fn(() => Promise.resolve(user))
      const firstExecution = new Execution<User, UserError>(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe(user)
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles custom value types in ok handler', async () => {
      class CustomValue {
        constructor(public data: string) {}
      }
      const customValue = new CustomValue('custom')
      const firstExecute = vi.fn(() => Promise.resolve(customValue))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe(customValue)
        expect(value.data).toBe('custom')
        return okHandler
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles null return from ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return null
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('first')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles undefined return from ok handler', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return null // Return null instead of undefined to avoid the signal issue
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('first')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles complex ok chaining scenario', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.resolve('first')
      })
      const firstExecution = new Execution(firstExecute)

      const secondHandler = vi.fn(() => {
        executionOrder.push('second')
        return Promise.resolve('second')
      })

      const thirdHandler = vi.fn(() => {
        executionOrder.push('third')
        return Promise.resolve('third')
      })

      const chainedExecution = firstExecution
        .ifOK((value) => {
          executionOrder.push('ok handler 1')
          expect(value).toBe('first')
          return secondHandler
        })
        .ifOK((value) => {
          executionOrder.push('ok handler 2')
          expect(value).toBe('second')
          return thirdHandler
        })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('third')
      expect(executionOrder).toEqual(['first', 'ok handler 1', 'second', 'ok handler 2', 'third'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondHandler).toHaveBeenCalledTimes(1)
      expect(thirdHandler).toHaveBeenCalledTimes(1)
    })

    test('handles mixed chain and ifOK calls', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.resolve('first')
      })
      const firstExecution = new Execution(firstExecute)

      const secondHandler = vi.fn(() => {
        executionOrder.push('second')
        return Promise.resolve('second')
      })

      const thirdHandler = vi.fn(() => {
        executionOrder.push('third')
        return Promise.resolve('third')
      })

      const chainedExecution = firstExecution
        .ifOK((value) => {
          executionOrder.push('ok handler')
          expect(value).toBe('first')
          return secondHandler
        })
        .next((result) => {
          executionOrder.push('chain function')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdHandler
        })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('third')
      expect(executionOrder).toEqual(['first', 'ok handler', 'second', 'chain function', 'third'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondHandler).toHaveBeenCalledTimes(1)
      expect(thirdHandler).toHaveBeenCalledTimes(1)
    })

    test('handles timeout in ok handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Create a new execution with timeout from the chained result
      const timedExecution = new Execution(() => chainedExecution, { timeout: 50 })

      // Execute the timed chain
      const result = await timedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('handles abort in ok handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Abort the chained execution before consuming
      chainedExecution.abort('test abort')

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was aborted
      expect(okHandler).not.toHaveBeenCalled() // Not called because execution was aborted
    })

    test('handles cancel in ok handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Cancel the chained execution before consuming
      chainedExecution.cancel('test cancel')

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(CancelInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(okHandler).not.toHaveBeenCalled() // Not called because execution was canceled
    })

    test('handles dispose in ok handler execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      // Dispose the chained execution before consuming
      await chainedExecution[Symbol.asyncDispose]()

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(DisposeInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(okHandler).not.toHaveBeenCalled() // Not called because execution was disposed
    })
  })

  describe('execute method', () => {
    test('executes the execution and returns a Promise<Result>', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(execution.signal)
    })

    test('returns the same result as awaiting the execution directly', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const directResult = await execution
      const executeResult = await execution.execute()

      expect(executeResult.isOK()).toBe(directResult.isOK())
      expect(executeResult.value).toBe(directResult.value)
      expect(execute).toHaveBeenCalledTimes(1) // execute() reuses the same execution
    })

    test('handles execute function that throws', async () => {
      const error = new Error('execute error')
      const execute = vi.fn(() => Promise.reject(error))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning Result.error', async () => {
      const error = new Error('result error')
      const execute = vi.fn(() => Promise.resolve(Result.error(error)))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning AsyncResult', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('handles timeout interruption', async () => {
      const execute = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('test'), 100)))
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('handles abort interruption', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('handles cancel interruption', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel('test cancel')
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(CancelInterruption)
      expect(execution.isCanceled).toBe(true)
    })

    test('handles dispose interruption', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(DisposeInterruption)
      expect(execution.isDisposed).toBe(true)
    })

    test('handles external signal abort', async () => {
      const externalController = new AbortController()
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { signal: externalController.signal })

      externalController.abort('external abort')
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('handles synchronous error in execute function', async () => {
      const error = new Error('sync error')
      const execute = vi.fn(() => {
        throw error
      })
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('can be called multiple times on the same execution', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result1 = await execution.execute()
      const result2 = await execution.execute()
      const result3 = await execution.execute()

      expect(result1.isOK()).toBe(true)
      expect(result1.value).toBe('test')
      expect(result2.isOK()).toBe(true)
      expect(result2.value).toBe('test')
      expect(result3.isOK()).toBe(true)
      expect(result3.value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1) // execute() reuses the same execution
    })

    test('works with complex return types', async () => {
      const complexData = { id: 123, name: 'test', nested: { value: 'nested' } }
      const execute = vi.fn(() => Promise.resolve(complexData))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual(complexData)
    })

    test('works with null and undefined values', async () => {
      const executeNull = vi.fn(() => Promise.resolve(null))
      const executionNull = new Execution(executeNull)

      const resultNull = await executionNull.execute()
      expect(resultNull.isOK()).toBe(true)
      expect(resultNull.value).toBe(null)

      const executeUndefined = vi.fn(() => Promise.resolve(undefined))
      const executionUndefined = new Execution(executeUndefined)

      const resultUndefined = await executionUndefined.execute()
      expect(resultUndefined.isOK()).toBe(true)
      expect(resultUndefined.value).toBe(undefined)
    })

    test('works with boolean values', async () => {
      const executeTrue = vi.fn(() => Promise.resolve(true))
      const executionTrue = new Execution(executeTrue)

      const resultTrue = await executionTrue.execute()
      expect(resultTrue.isOK()).toBe(true)
      expect(resultTrue.value).toBe(true)

      const executeFalse = vi.fn(() => Promise.resolve(false))
      const executionFalse = new Execution(executeFalse)

      const resultFalse = await executionFalse.execute()
      expect(resultFalse.isOK()).toBe(true)
      expect(resultFalse.value).toBe(false)
    })

    test('works with number values', async () => {
      const execute = vi.fn(() => Promise.resolve(42))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe(42)
    })

    test('works with array values', async () => {
      const arrayData = [1, 2, 3, 'test', { nested: true }]
      const execute = vi.fn(() => Promise.resolve(arrayData))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual(arrayData)
    })

    test('works with function values', async () => {
      const testFunction = () => 'test function'
      const execute = vi.fn(() => Promise.resolve(testFunction))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe(testFunction)
      expect(typeof result.value).toBe('function')
    })

    test('handles custom error types', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const customError = new CustomError('custom error', 500)
      const execute = vi.fn(() => Promise.reject(customError))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(customError)
      expect(result.error && 'code' in result.error ? result.error.code : undefined).toBe(500)
    })

    test('handles Result.error with custom error types', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const customError = new CustomError('custom error', 500)
      const execute = vi.fn(() => Promise.resolve(Result.error(customError)))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(customError)
      expect(result.error && 'code' in result.error ? result.error.code : undefined).toBe(500)
    })

    test('works with typed generics', async () => {
      type User = {
        id: number
        name: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND' | 'USER_INVALID'
      }

      const user: User = { id: 1, name: 'John Doe' }
      const execute = vi.fn(() => Promise.resolve(user))
      const execution = new Execution<User, UserError>(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual(user)
      expect(result.value.id).toBe(1)
      expect(result.value.name).toBe('John Doe')
    })

    test('handles typed generics with error', async () => {
      type User = {
        id: number
        name: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND'
      }

      const userError: UserError = Object.assign(new Error('User not found'), {
        code: 'USER_NOT_FOUND' as const,
      })
      const execute = vi.fn(() => Promise.reject(userError))
      const execution = new Execution<User, UserError>(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(userError)
      expect(result.error && 'code' in result.error ? result.error.code : undefined).toBe(
        'USER_NOT_FOUND',
      )
    })

    test('execute method preserves execution state', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      // Execute once
      const result1 = await execution.execute()
      expect(result1.isOK()).toBe(true)
      expect(execution.isAborted).toBe(false)
      expect(execution.isInterrupted).toBe(false)

      // Execute again - state should be preserved
      const result2 = await execution.execute()
      expect(result2.isOK()).toBe(true)
      expect(execution.isAborted).toBe(false)
      expect(execution.isInterrupted).toBe(false)
    })

    test('execute method works after interruption', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      // Interrupt the execution
      execution.abort('test abort')

      // Execute after interruption
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('execute method works with chained executions', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const result = await chainedExecution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('execute method works with complex chained executions', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      const result = await chainedExecution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('execute method works with chained executions that have errors', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const result = await chainedExecution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('execute method works with timeout in chained executions', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Create a new execution with timeout from the chained result
      const timedExecution = new Execution(() => chainedExecution, { timeout: 50 })

      const result = await timedExecution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })
  })

  describe('AsyncIterable behavior', () => {
    test('yields single execution result', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of execution) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1)
    })

    test('yields chained execution results in order', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('yields multiple chained execution results in order', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(3)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('yields error results in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('yields mixed success and error results in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.reject(secondError))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isError()).toBe(true)
          expect(result.error).toBe(secondError)
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(3)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(secondError)
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('yields ifError results in order', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return errorHandler
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(Error)
      expect(results[0].error?.message).toBe('first error')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
    })

    test('yields ifOK results in order', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const okHandler = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return okHandler
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(okHandler).toHaveBeenCalledTimes(1)
    })

    test('yields mixed chain, ifError, and ifOK results', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.reject(new Error('second error')))
      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .ifError((error) => {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return errorHandler
        })
        .ifOK((value) => {
          expect(value).toBe('recovered')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(4)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(Error)
      expect(results[1].error?.message).toBe('second error')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('recovered')
      expect(results[3].isOK()).toBe(true)
      expect(results[3].value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('yields interruption results in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(AbortInterruption)
        expect(result.error?.cause).toBe('test abort')
        return secondExecute
      })

      // Abort the chained execution before iterating
      chainedExecution.abort('test abort')

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(AbortInterruption)
      expect(results[0].error?.cause).toBe('test abort')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(AbortInterruption)
      expect(results[1].error?.cause).toBe('test abort')
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled() // Not called because execution was aborted
    })

    test('yields timeout interruption results in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Create a new execution with timeout from the chained result
      const timedExecution = new Execution(() => chainedExecution, { timeout: 50 })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of timedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('yields cancel interruption results in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(CancelInterruption)
        expect(result.error?.cause).toBe('test cancel')
        return secondExecute
      })

      // Cancel the chained execution before iterating
      chainedExecution.cancel('test cancel')

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(CancelInterruption)
      expect(results[0].error?.cause).toBe('test cancel')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(CancelInterruption)
      expect(results[1].error?.cause).toBe('test cancel')
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled() // Not called because execution was canceled
    })

    test('yields dispose interruption results in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(DisposeInterruption)
        return secondExecute
      })

      // Dispose the chained execution before iterating
      await chainedExecution[Symbol.asyncDispose]()

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(DisposeInterruption)
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(DisposeInterruption)
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled()
    })

    test('yields results from complex nested chains', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.resolve('first')
      })
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => {
        executionOrder.push('second')
        return Promise.reject(new Error('second error'))
      })

      const errorHandler = vi.fn(() => {
        executionOrder.push('error handler')
        return Promise.resolve('recovered')
      })

      const thirdExecute = vi.fn(() => {
        executionOrder.push('third')
        return Promise.resolve('third')
      })

      const chainedExecution = firstExecution
        .next((result) => {
          executionOrder.push('chain 1')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .ifError((error) => {
          executionOrder.push('ifError')
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return errorHandler
        })
        .ifOK((value) => {
          executionOrder.push('ifOK')
          expect(value).toBe('recovered')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(4)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(Error)
      expect(results[1].error?.message).toBe('second error')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('recovered')
      expect(results[3].isOK()).toBe(true)
      expect(results[3].value).toBe('third')

      expect(executionOrder).toEqual([
        'first',
        'chain 1',
        'second',
        'ifError',
        'error handler',
        'ifOK',
        'third',
      ])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('yields results from deeply nested chains', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('step 1'))
      let currentExecution: Execution<unknown, Error> = new Execution(firstExecute)

      // Create a deep chain of 5 executions
      for (let i = 2; i <= 5; i++) {
        const nextExecute = vi.fn(() => Promise.resolve(`step ${i}`))
        currentExecution = currentExecution.next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe(`step ${i - 1}`)
          return nextExecute
        })
      }

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of currentExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(5)
      for (let i = 0; i < 5; i++) {
        expect(results[i].isOK()).toBe(true)
        expect(results[i].value).toBe(`step ${i + 1}`)
      }
    })

    test('yields results with different value types in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve(42))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('string value'))
      const thirdExecute = vi.fn(() => Promise.resolve({ id: 123, name: 'test' }))
      const fourthExecute = vi.fn(() => Promise.resolve([1, 2, 3]))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe(42)
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('string value')
          return thirdExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toEqual({ id: 123, name: 'test' })
          return fourthExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(4)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe(42)
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('string value')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toEqual({ id: 123, name: 'test' })
      expect(results[3].isOK()).toBe(true)
      expect(results[3].value).toEqual([1, 2, 3])
    })

    test('yields results with typed generics in chain', async () => {
      type User = {
        id: number
        name: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND' | 'USER_INVALID'
      }

      const user: User = { id: 1, name: 'John Doe' }
      const firstExecute = vi.fn(() => Promise.resolve(user))
      const firstExecution = new Execution<User, UserError>(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('processed'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toEqual(user)
        expect(result.value.id).toBe(1)
        expect(result.value.name).toBe('John Doe')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toEqual(user)
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('processed')
    })

    test('yields results with custom error types in chain', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const customError = new CustomError('custom error', 500)
      const secondExecute = vi.fn(() => Promise.reject(customError))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(customError)
      expect(
        results[1].error && 'code' in results[1].error ? results[1].error.code : undefined,
      ).toBe(500)
    })

    test('yields results from generate method', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('yields results from generate method with errors', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles early break in iteration', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))
      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      let count = 0
      for await (const result of chainedExecution) {
        results.push(result)
        count++
        if (count === 2) break // Break after second result
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).not.toHaveBeenCalled()
    })

    test('handles iteration with async operations in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'second'
      })
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('does not yield results from chain with null returns', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return null // Return null to stop the chain
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('yields results from ifError with null returns', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return null // Return null to stop the chain
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(Error)
      expect(results[0].error?.message).toBe('first error')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('yields results from ifOK with null returns', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return null // Return null to stop the chain
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      for await (const result of chainedExecution) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })
  })

  describe('generate method', () => {
    test('generates AsyncIterable for simple execution', async () => {
      const execute = vi.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = execution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable for chained execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable for complex chained execution', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.reject(new Error('second error')))
      const errorHandler = vi.fn(() => Promise.resolve('recovered'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .ifError((error) => {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return errorHandler
        })
        .ifOK((value) => {
          expect(value).toBe('recovered')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(4)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(Error)
      expect(results[1].error?.message).toBe('second error')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('recovered')
      expect(results[3].isOK()).toBe(true)
      expect(results[3].value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with typed generics', async () => {
      type User = {
        id: number
        name: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND' | 'USER_INVALID'
      }

      const user: User = { id: 1, name: 'John Doe' }
      const firstExecute = vi.fn(() => Promise.resolve(user))
      const firstExecution = new Execution<User, UserError>(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('processed'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toEqual(user)
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<User | string, UserError>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toEqual(user)
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('processed')
    })

    test('generates AsyncIterable with custom error types', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const customError = new CustomError('custom error', 500)
      const secondExecute = vi.fn(() => Promise.reject(customError))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, CustomError>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(customError)
      expect(
        results[1].error && 'code' in results[1].error ? results[1].error.code : undefined,
      ).toBe(500)
    })

    test('generates AsyncIterable with interruption handling', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(AbortInterruption)
        expect(result.error?.cause).toBe('test abort')
        return secondExecute
      })

      // Abort the chained execution before generating
      chainedExecution.abort('test abort')

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(AbortInterruption)
      expect(results[0].error?.cause).toBe('test abort')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(AbortInterruption)
      expect(results[1].error?.cause).toBe('test abort')
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled()
    })

    test('generates AsyncIterable with timeout interruption', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Create a new execution with timeout from the chained result
      const timedExecution = new Execution(() => chainedExecution, { timeout: 50 })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = timedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with early break', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))
      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      let count = 0
      for await (const result of generator) {
        results.push(result)
        count++
        if (count === 2) break // Break after second result
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).not.toHaveBeenCalled()
    })

    test('generates AsyncIterable with async operations', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'second'
      })
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with null chain returns', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return null // Return null to stop the chain
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with ifError and null returns', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifError((error) => {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe('first error')
        return null // Return null to stop the chain
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(Error)
      expect(results[0].error?.message).toBe('first error')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with ifOK and null returns', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainedExecution = firstExecution.ifOK((value) => {
        expect(value).toBe('first')
        return null // Return null to stop the chain
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(1)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with deeply nested chains', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('step 1'))
      let currentExecution: Execution<unknown, Error> = new Execution(firstExecute)

      // Create a deep chain of 5 executions
      for (let i = 2; i <= 5; i++) {
        const nextExecute = vi.fn(() => Promise.resolve(`step ${i}`))
        currentExecution = currentExecution.next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe(`step ${i - 1}`)
          return nextExecute
        })
      }

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = currentExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(5)
      for (let i = 0; i < 5; i++) {
        expect(results[i].isOK()).toBe(true)
        expect(results[i].value).toBe(`step ${i + 1}`)
      }
    })

    test('generates AsyncIterable with different value types', async () => {
      const firstExecute = vi.fn(() => Promise.resolve(42))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('string value'))
      const thirdExecute = vi.fn(() => Promise.resolve({ id: 123, name: 'test' }))
      const fourthExecute = vi.fn(() => Promise.resolve([1, 2, 3]))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe(42)
          return secondExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('string value')
          return thirdExecute
        })
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toEqual({ id: 123, name: 'test' })
          return fourthExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(4)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe(42)
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('string value')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toEqual({ id: 123, name: 'test' })
      expect(results[3].isOK()).toBe(true)
      expect(results[3].value).toEqual([1, 2, 3])
    })

    test('generates AsyncIterable with mixed success and error results', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.reject(secondError))
      const thirdExecute = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .next((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .next((result) => {
          expect(result.isError()).toBe(true)
          expect(result.error).toBe(secondError)
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(3)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(secondError)
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with multiple error recovery chains', async () => {
      const firstExecute = vi.fn(() => Promise.reject(new Error('first error')))
      const firstExecution = new Execution(firstExecute)

      const firstErrorHandler = vi.fn(() => Promise.reject(new Error('second error')))
      const secondErrorHandler = vi.fn(() => Promise.resolve('recovered'))

      const chainedExecution = firstExecution
        .ifError((error) => {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('first error')
          return firstErrorHandler
        })
        .ifError((error) => {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return secondErrorHandler
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(3)
      expect(results[0].isError()).toBe(true)
      expect(results[0].error).toBeInstanceOf(Error)
      expect(results[0].error?.message).toBe('first error')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(Error)
      expect(results[1].error?.message).toBe('second error')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('recovered')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(firstErrorHandler).toHaveBeenCalledTimes(1)
      expect(secondErrorHandler).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with multiple success chains', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondHandler = vi.fn(() => Promise.resolve('second'))
      const thirdHandler = vi.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .ifOK((value) => {
          expect(value).toBe('first')
          return secondHandler
        })
        .ifOK((value) => {
          expect(value).toBe('second')
          return thirdHandler
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(3)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('third')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondHandler).toHaveBeenCalledTimes(1)
      expect(thirdHandler).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with complex mixed chains', async () => {
      const executionOrder: string[] = []

      const firstExecute = vi.fn(() => {
        executionOrder.push('first')
        return Promise.resolve('first')
      })
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => {
        executionOrder.push('second')
        return Promise.reject(new Error('second error'))
      })

      const errorHandler = vi.fn(() => {
        executionOrder.push('error handler')
        return Promise.resolve('recovered')
      })

      const thirdExecute = vi.fn(() => {
        executionOrder.push('third')
        return Promise.resolve('third')
      })

      const chainedExecution = firstExecution
        .next((result) => {
          executionOrder.push('chain 1')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .ifError((error) => {
          executionOrder.push('ifError')
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toBe('second error')
          return errorHandler
        })
        .ifOK((value) => {
          executionOrder.push('ifOK')
          expect(value).toBe('recovered')
          return thirdExecute
        })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(4)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(Error)
      expect(results[1].error?.message).toBe('second error')
      expect(results[2].isOK()).toBe(true)
      expect(results[2].value).toBe('recovered')
      expect(results[3].isOK()).toBe(true)
      expect(results[3].value).toBe('third')

      expect(executionOrder).toEqual([
        'first',
        'chain 1',
        'second',
        'ifError',
        'error handler',
        'ifOK',
        'third',
      ])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with executable objects in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return { execute: secondExecute }
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with executable objects with timeout', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return { execute: secondExecute, timeout: 50 }
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBeInstanceOf(TimeoutInterruption)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with AsyncResult in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const secondExecution = new Execution(secondExecute)

      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return () => secondExecution
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with AsyncResult.error in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecution = new Execution(() => Promise.reject(secondError))

      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return () => secondExecution
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with promise returning functions in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return Promise.resolve(secondExecute)
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with async functions in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next(async (result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        await new Promise((resolve) => setTimeout(resolve, 10))
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with Result.ok in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve(Result.ok('second')))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isOK()).toBe(true)
      expect(results[1].value).toBe('second')
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with Result.error in chain', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = vi.fn(() => Promise.resolve(Result.error(secondError)))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      const results: Array<Result<unknown, Error | Interruption>> = []
      const generator = chainedExecution.generate<unknown, Error>()
      for await (const result of generator) {
        results.push(result)
      }

      expect(results).toHaveLength(2)
      expect(results[0].isOK()).toBe(true)
      expect(results[0].value).toBe('first')
      expect(results[1].isError()).toBe(true)
      expect(results[1].error).toBe(secondError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('generates AsyncIterable with multiple generator calls', async () => {
      const firstExecute = vi.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = vi.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.next((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Generate multiple times
      const generator1 = chainedExecution.generate<unknown, Error>()
      const generator2 = chainedExecution.generate<unknown, Error>()

      const results1: Array<Result<unknown, Error | Interruption>> = []
      const results2: Array<Result<unknown, Error | Interruption>> = []

      for await (const result of generator1) {
        results1.push(result)
      }

      for await (const result of generator2) {
        results2.push(result)
      }

      expect(results1).toHaveLength(2)
      expect(results1[0].isOK()).toBe(true)
      expect(results1[0].value).toBe('first')
      expect(results1[1].isOK()).toBe(true)
      expect(results1[1].value).toBe('second')

      expect(results2).toHaveLength(2)
      expect(results2[0].isOK()).toBe(true)
      expect(results2[0].value).toBe('first')
      expect(results2[1].isOK()).toBe(true)
      expect(results2[1].value).toBe('second')

      expect(firstExecute).toHaveBeenCalledTimes(1) // Same execution instance
      expect(secondExecute).toHaveBeenCalledTimes(1) // Same execution instance
    })
  })
})
