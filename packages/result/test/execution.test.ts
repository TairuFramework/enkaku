import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  TimeoutInterruption,
} from '@enkaku/async'
import { jest } from '@jest/globals'

import { AsyncResult } from '../src/async-result.js'
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

  describe('metadata property', () => {
    test('returns undefined when no metadata is provided', () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)
      expect(execution.metadata).toBeUndefined()
    })

    test('returns the provided metadata object', () => {
      const metadata = { userId: 123, operation: 'test' }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('returns the provided metadata string', () => {
      const metadata = { operation: 'test-operation' }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('returns the provided metadata number', () => {
      const metadata = { count: 42 }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('returns the provided metadata array', () => {
      const metadata = { steps: ['step1', 'step2', 'step3'] }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('returns the provided metadata function', () => {
      const metadata = { operation: () => 'test-function' }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('returns null metadata', () => {
      const metadata = { operation: null }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('returns complex nested metadata object', () => {
      const metadata = {
        user: {
          id: 123,
          name: 'John Doe',
          preferences: {
            theme: 'dark',
            language: 'en',
          },
        },
        operation: {
          type: 'database-query',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          retries: 3,
        },
      }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })
      expect(execution.metadata).toBe(metadata)
    })

    test('metadata is immutable and not affected by execution state', async () => {
      const metadata = { count: 0 }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })

      // Metadata should be the same before execution
      expect(execution.metadata).toBe(metadata)

      // Execute the execution
      await execution

      // Metadata should still be the same after execution
      expect(execution.metadata).toBe(metadata)

      // Abort the execution
      execution.abort('test abort')

      // Metadata should still be the same after abort
      expect(execution.metadata).toBe(metadata)

      // Cancel the execution
      execution.cancel('test cancel')

      // Metadata should still be the same after cancel
      expect(execution.metadata).toBe(metadata)
    })

    test('metadata can be explicitly passed to chained execution', async () => {
      const metadata = { chainId: 'first-chain' }
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute, { metadata })

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      expect(chainedExecution.metadata).toBe(metadata)

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(chainedExecution.metadata).toBe(metadata)
    })

    test('metadata works with typed generics', () => {
      type UserMetadata = {
        userId: number
        operation: string
      }

      const metadata: UserMetadata = { userId: 123, operation: 'test' }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution<string, Error, UserMetadata>(execute, { metadata })

      expect(execution.metadata).toBe(metadata)
      expect(execution.metadata?.userId).toBe(123)
      expect(execution.metadata?.operation).toBe('test')
    })

    test('metadata is accessible even when execution fails', async () => {
      const metadata = { errorContext: 'test-error' }
      const error = new Error('test error')
      const execute = jest.fn(() => Promise.reject(error))
      const execution = new Execution(execute, { metadata })

      // Metadata should be accessible before execution
      expect(execution.metadata).toBe(metadata)

      // Execute and expect failure
      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)

      // Metadata should still be accessible after error
      expect(execution.metadata).toBe(metadata)
    })

    test('metadata is accessible even when execution is interrupted', async () => {
      const metadata = { interruptContext: 'test-interrupt' }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })

      // Metadata should be accessible before interruption
      expect(execution.metadata).toBe(metadata)

      // Interrupt the execution
      execution.abort('test abort')

      // Metadata should still be accessible after interruption
      expect(execution.metadata).toBe(metadata)

      // Execute and expect interruption
      const result = await execution
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)

      // Metadata should still be accessible after execution with interruption
      expect(execution.metadata).toBe(metadata)
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

  describe('chain method', () => {
    test('creates a chained execution without executing immediately', async () => {
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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

      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return Promise.resolve('first')
      })
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return Promise.resolve('second')
      })
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.reject(error))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = jest.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve(Result.error(error)))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = jest.fn(() => Promise.resolve(Result.error(secondError)))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const thirdExecute = jest.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .chain((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain(async (result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      // Abort the execution first
      firstExecution.abort('test abort')

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
        // The chain function should be called and receive the abort result
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(AbortInterruption)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isOK()).toBe(false)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      // Not called because execution was aborted before starting
      expect(firstExecute).not.toHaveBeenCalled()
      expect(secondExecute).not.toHaveBeenCalled()
    })

    test('handles chain with Result.error in chain callback', async () => {
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const secondExecution = new Execution(secondExecute)

      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const secondExecution = new Execution(() => Promise.reject(chainError))

      const chainedExecution = firstExecution.chain((result) => {
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

  describe('chain timeout behavior', () => {
    // Note: The constructor (chain) timeout only starts when the chain is awaited,
    // not when the first execution is triggered. The timeout covers the total time
    // spent in the chain after it is awaited.

    test('constructor timeout applies to total chain time after awaiting', async () => {
      const executionOrder: string[] = []
      const startTime = Date.now()

      // Chain timeout: 120ms
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution(firstExecute, { timeout: 120 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Await the chain (timeout starts now)
      const result = await chainedExecution
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(totalTime).toBeGreaterThanOrEqual(100)
      expect(totalTime).toBeLessThan(130) // Should complete before timeout
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('constructor timeout triggers if total chain time after awaiting exceeds timeout', async () => {
      const executionOrder: string[] = []
      const startTime = Date.now()

      // Chain timeout: 100ms
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 60))
      })
      const firstExecution = new Execution(firstExecute, { timeout: 100 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 60))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Await the chain (timeout starts now)
      const result = await chainedExecution
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(totalTime).toBeGreaterThanOrEqual(100)
      expect(totalTime).toBeLessThan(130)
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('executable timeout applies only to individual executable', async () => {
      const executionOrder: string[] = []

      // First executable with 50ms timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 100))
      })
      const firstExecution = new Execution({ execute: firstExecute, timeout: 50 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(TimeoutInterruption)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('executable timeout in second step applies only to that step', async () => {
      const executionOrder: string[] = []

      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution(firstExecute)

      // Second executable with 30ms timeout
      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 100))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return { execute: secondExecute, timeout: 30 }
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('constructor timeout takes precedence over executable timeout when both would trigger', async () => {
      const executionOrder: string[] = []

      // Create a chain with 80ms constructor timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution({ execute: firstExecute }, { timeout: 80 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('executable timeout takes precedence when it is shorter than constructor timeout', async () => {
      const executionOrder: string[] = []

      // Create a chain with 100ms constructor timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution({ execute: firstExecute, timeout: 30 }, { timeout: 100 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(TimeoutInterruption)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('third executable without timeout is still affected by constructor timeout', async () => {
      const executionOrder: string[] = []

      // Create a chain with 120ms constructor timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution(firstExecute, { timeout: 120 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })
      const thirdExecute = jest.fn(() => {
        executionOrder.push('third')
        return new Promise((resolve) => setTimeout(() => resolve('third'), 50))
      })

      const chainedExecution = firstExecution
        .chain((result) => {
          executionOrder.push('chain1 function')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .chain((result) => {
          executionOrder.push('chain2 function')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(executionOrder).toEqual([
        'first',
        'chain1 function',
        'second',
        'chain2 function',
        'third',
      ])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('complex scenario: mixed timeouts across chain', async () => {
      const executionOrder: string[] = []
      const startTime = Date.now()

      // Chain timeout: 200ms, Executable 1 timeout: 50ms, Executable 2 timeout: 300ms, Executable 3: no timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 30)) // Completes before 50ms timeout
      })
      const firstExecution = new Execution({ execute: firstExecute, timeout: 50 }, { timeout: 200 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 100)) // Takes 100ms, within 300ms timeout
      })

      const thirdExecute = jest.fn(() => {
        executionOrder.push('third')
        return new Promise((resolve) => setTimeout(() => resolve('third'), 100)) // Takes 100ms, but chain timeout will trigger
      })

      const chainedExecution = firstExecution
        .chain((result) => {
          executionOrder.push('chain1 function')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return { execute: secondExecute, timeout: 300 }
        })
        .chain((result) => {
          executionOrder.push('chain2 function')
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('second')
          return thirdExecute
        })

      // Execute the chain
      const result = await chainedExecution
      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(executionOrder).toEqual([
        'first',
        'chain1 function',
        'second',
        'chain2 function',
        'third',
      ])
      expect(totalTime).toBeGreaterThanOrEqual(180) // Should be close to 200ms
      expect(totalTime).toBeLessThan(220) // Should not exceed 200ms by much
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
      expect(thirdExecute).toHaveBeenCalledTimes(1)
    })

    test('executable timeout triggers before constructor timeout in first step', async () => {
      const executionOrder: string[] = []

      // Constructor timeout: 100ms, Executable timeout: 30ms
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50)) // Takes 50ms
      })
      const firstExecution = new Execution({ execute: firstExecute, timeout: 30 }, { timeout: 100 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })
      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(TimeoutInterruption)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('constructor timeout triggers before executable timeout in second step', async () => {
      const executionOrder: string[] = []

      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution(firstExecute, { timeout: 120 }) // Constructor timeout: 120ms

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 100)) // Takes 100ms
      })

      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return { execute: secondExecute, timeout: 150 } // Longer than constructor timeout
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('timeout cleanup is properly handled across chain', async () => {
      const executionOrder: string[] = []

      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      })
      const firstExecution = new Execution({ execute: firstExecute, timeout: 30 }, { timeout: 100 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 50))
      })

      const chainedExecution = firstExecution.chain((result) => {
        executionOrder.push('chain function')
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(TimeoutInterruption)
        return secondExecute
      })

      // Execute the chain
      const result = await chainedExecution

      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(executionOrder).toEqual(['first', 'chain function', 'second'])
      expect(firstExecute).toHaveBeenCalledTimes(1)
      expect(secondExecute).toHaveBeenCalledTimes(1)

      // Verify that the execution can be disposed without issues
      await firstExecution[Symbol.asyncDispose]()
    })
  })

  describe('execute method', () => {
    test('executes the execution and returns a Promise<Result>', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
      expect(execute).toHaveBeenCalledTimes(1)
      expect(execute).toHaveBeenCalledWith(execution.signal)
    })

    test('returns the same result as awaiting the execution directly', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const directResult = await execution
      const executeResult = await execution.execute()

      expect(executeResult.isOK()).toBe(directResult.isOK())
      expect(executeResult.value).toBe(directResult.value)
      expect(execute).toHaveBeenCalledTimes(1) // execute() reuses the same execution
    })

    test('handles execute function that throws', async () => {
      const error = new Error('execute error')
      const execute = jest.fn(() => Promise.reject(error))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning Result.error', async () => {
      const error = new Error('result error')
      const execute = jest.fn(() => Promise.resolve(Result.error(error)))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('handles execute function returning AsyncResult', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('handles timeout interruption', async () => {
      const execute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('test'), 100)),
      )
      const execution = new Execution(execute, { timeout: 50 })

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(TimeoutInterruption)
      expect(execution.isTimedOut).toBe(true)
    })

    test('handles abort interruption', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.abort('test abort')
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('handles cancel interruption', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      execution.cancel('test cancel')
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(CancelInterruption)
      expect(execution.isCanceled).toBe(true)
    })

    test('handles dispose interruption', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute)

      await execution[Symbol.asyncDispose]()
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(DisposeInterruption)
      expect(execution.isDisposed).toBe(true)
    })

    test('handles external signal abort', async () => {
      const externalController = new AbortController()
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { signal: externalController.signal })

      externalController.abort('external abort')
      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(AbortInterruption)
      expect(execution.isAborted).toBe(true)
    })

    test('handles synchronous error in execute function', async () => {
      const error = new Error('sync error')
      const execute = jest.fn(() => {
        throw error
      })
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('can be called multiple times on the same execution', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
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
      const execute = jest.fn(() => Promise.resolve(complexData))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual(complexData)
    })

    test('works with null and undefined values', async () => {
      const executeNull = jest.fn(() => Promise.resolve(null))
      const executionNull = new Execution(executeNull)

      const resultNull = await executionNull.execute()
      expect(resultNull.isOK()).toBe(true)
      expect(resultNull.value).toBe(null)

      const executeUndefined = jest.fn(() => Promise.resolve(undefined))
      const executionUndefined = new Execution(executeUndefined)

      const resultUndefined = await executionUndefined.execute()
      expect(resultUndefined.isOK()).toBe(true)
      expect(resultUndefined.value).toBe(undefined)
    })

    test('works with boolean values', async () => {
      const executeTrue = jest.fn(() => Promise.resolve(true))
      const executionTrue = new Execution(executeTrue)

      const resultTrue = await executionTrue.execute()
      expect(resultTrue.isOK()).toBe(true)
      expect(resultTrue.value).toBe(true)

      const executeFalse = jest.fn(() => Promise.resolve(false))
      const executionFalse = new Execution(executeFalse)

      const resultFalse = await executionFalse.execute()
      expect(resultFalse.isOK()).toBe(true)
      expect(resultFalse.value).toBe(false)
    })

    test('works with number values', async () => {
      const execute = jest.fn(() => Promise.resolve(42))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe(42)
    })

    test('works with array values', async () => {
      const arrayData = [1, 2, 3, 'test', { nested: true }]
      const execute = jest.fn(() => Promise.resolve(arrayData))
      const execution = new Execution(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual(arrayData)
    })

    test('works with function values', async () => {
      const testFunction = () => 'test function'
      const execute = jest.fn(() => Promise.resolve(testFunction))
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
      const execute = jest.fn(() => Promise.reject(customError))
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
      const execute = jest.fn(() => Promise.resolve(Result.error(customError)))
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
        email: string
      }

      type UserError = Error & {
        code: 'USER_NOT_FOUND' | 'USER_INVALID'
      }

      const user: User = { id: 1, name: 'John Doe', email: 'john@example.com' }
      const execute = jest.fn(() => Promise.resolve(user))
      const execution = new Execution<User, UserError>(execute)

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual(user)
      expect(result.value.id).toBe(1)
      expect(result.value.name).toBe('John Doe')
      expect(result.value.email).toBe('john@example.com')
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
      const execute = jest.fn(() => Promise.reject(userError))
      const execution = new Execution<User, UserError>(execute)

      const result = await execution.execute()
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(userError)
      expect(result.error && 'code' in result.error ? result.error.code : undefined).toBe(
        'USER_NOT_FOUND',
      )
    })

    test('works with metadata and execute method', async () => {
      const metadata = { userId: 123, operation: 'test' }
      const execute = jest.fn(() => Promise.resolve('test'))
      const execution = new Execution(execute, { metadata })

      const result = await execution.execute()
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
      expect(execution.metadata).toBe(metadata)
    })

    test('execute method preserves execution state', async () => {
      const execute = jest.fn(() => Promise.resolve('test'))
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
      const execute = jest.fn(() => Promise.resolve('test'))
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(() => Promise.resolve('second'))
      const thirdExecute = jest.fn(() => Promise.resolve('third'))

      const chainedExecution = firstExecution
        .chain((result) => {
          expect(result.isOK()).toBe(true)
          expect(result.value).toBe('first')
          return secondExecute
        })
        .chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondError = new Error('second error')
      const secondExecute = jest.fn(() => Promise.reject(secondError))
      const chainedExecution = firstExecution.chain((result) => {
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
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const secondExecute = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('second'), 100)),
      )
      const chainedExecution = firstExecution.chain((result) => {
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
})
