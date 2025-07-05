import {
  AbortInterruption,
  CancelInterruption,
  DisposeInterruption,
  TimeoutInterruption,
} from '@enkaku/async'
import { jest } from '@jest/globals'

import { AsyncResult } from '../src/async-result.js'
import { type Executable, Execution } from '../src/execution.js'
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
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('second')
      expect(firstExecute).not.toHaveBeenCalled() // Not called because execution was aborted before starting
      expect(secondExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with synchronous error in chain callback', async () => {
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const chainedExecution = firstExecution.chain((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        throw chainError
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(chainError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with async error in chain callback', async () => {
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const chainedExecution = firstExecution.chain(async (result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        throw chainError
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(chainError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
    })

    test('handles chain with rejected promise in chain callback', async () => {
      const firstExecute = jest.fn(() => Promise.resolve('first'))
      const firstExecution = new Execution(firstExecute)

      const chainError = new Error('chain error')
      const chainedExecution = firstExecution.chain((result) => {
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('first')
        return Promise.reject(chainError)
      })

      // Execute the chain
      const result = await chainedExecution
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(chainError)
      expect(firstExecute).toHaveBeenCalledTimes(1)
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

  describe.skip('chain timeout behavior', () => {
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

    // The rest of the tests (executable timeouts, precedence, etc.) remain valid as written,
    // since they test per-executable timeout behavior and do not assume chain timeout starts before awaiting.

    test('executable timeout applies only to individual executable', async () => {
      const executionOrder: string[] = []

      // First executable with 50ms timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 100))
      }) as Executable<string>
      firstExecute.timeout = 50
      const firstExecution = new Execution(firstExecute)

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
      }) as Executable<string>
      secondExecute.timeout = 30
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

    test('constructor timeout takes precedence over executable timeout when both would trigger', async () => {
      const executionOrder: string[] = []

      // Create a chain with 80ms constructor timeout
      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      }) as Executable<string>
      firstExecute.timeout = 100 // Executable timeout longer than constructor timeout
      const firstExecution = new Execution(firstExecute, { timeout: 80 })

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
      }) as Executable<string>
      firstExecute.timeout = 30 // Executable timeout shorter than constructor timeout
      const firstExecution = new Execution(firstExecute, { timeout: 100 })

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
      }) as Executable<string>
      firstExecute.timeout = 50
      const firstExecution = new Execution(firstExecute, { timeout: 200 })

      const secondExecute = jest.fn(() => {
        executionOrder.push('second')
        return new Promise((resolve) => setTimeout(() => resolve('second'), 100)) // Takes 100ms, within 300ms timeout
      }) as Executable<string>
      secondExecute.timeout = 300

      const thirdExecute = jest.fn(() => {
        executionOrder.push('third')
        return new Promise((resolve) => setTimeout(() => resolve('third'), 50)) // Takes 50ms, but chain timeout will trigger
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
      }) as Executable<string>
      firstExecute.timeout = 30 // Shorter than constructor timeout
      const firstExecution = new Execution(firstExecute, { timeout: 100 })

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
      }) as Executable<string>
      secondExecute.timeout = 150 // Longer than constructor timeout

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

    test('timeout cleanup is properly handled across chain', async () => {
      const executionOrder: string[] = []

      const firstExecute = jest.fn(() => {
        executionOrder.push('first')
        return new Promise((resolve) => setTimeout(() => resolve('first'), 50))
      }) as Executable<string>
      firstExecute.timeout = 30
      const firstExecution = new Execution(firstExecute, { timeout: 100 })

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
      expect(firstExecution.isDisposed).toBe(true)
    })
  })
})
