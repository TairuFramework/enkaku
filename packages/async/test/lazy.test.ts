import { describe, expect, test, vi } from 'vitest'

import { LazyPromise, lazy } from '../src/lazy.js'
import { sleep } from '../src/utils.js'

describe('LazyPromise', () => {
  describe('static methods', () => {
    describe('LazyPromise.from()', () => {
      test('creates a LazyPromise from a function', async () => {
        const execute = vi.fn(() => Promise.resolve('OK'))
        const promise = LazyPromise.from(execute)
        expect(promise).toBeInstanceOf(LazyPromise)
        expect(promise).toBeInstanceOf(Promise)
        await expect(promise).resolves.toBe('OK')
        expect(execute).toHaveBeenCalledTimes(1)
      })

      test('creates a LazyPromise from a synchronous function', async () => {
        const execute = vi.fn(() => 'OK')
        const promise = LazyPromise.from(execute)
        await expect(promise).resolves.toBe('OK')
        expect(execute).toHaveBeenCalledTimes(1)
      })

      test('handles errors from the execute function', async () => {
        const execute = vi.fn(() => Promise.reject('failed'))
        const promise = LazyPromise.from(execute)
        await expect(promise).rejects.toBe('failed')
        expect(execute).toHaveBeenCalledTimes(1)
      })
    })

    describe('LazyPromise.resolve()', () => {
      test('creates a resolved LazyPromise', async () => {
        const promise = LazyPromise.resolve('OK')
        expect(promise).toBeInstanceOf(LazyPromise)
        await expect(promise).resolves.toBe('OK')
      })

      test('resolves with different value types', async () => {
        const stringPromise = LazyPromise.resolve('string')
        const numberPromise = LazyPromise.resolve(42)
        const objectPromise = LazyPromise.resolve({ key: 'value' })

        await expect(stringPromise).resolves.toBe('string')
        await expect(numberPromise).resolves.toBe(42)
        await expect(objectPromise).resolves.toEqual({ key: 'value' })
      })
    })

    describe('LazyPromise.reject()', () => {
      test('creates a rejected LazyPromise', async () => {
        const promise = LazyPromise.reject('failed')
        expect(promise).toBeInstanceOf(LazyPromise)
        await expect(promise).rejects.toBe('failed')
      })

      test('rejects with different error types', async () => {
        const errorPromise = LazyPromise.reject(new Error('test error'))
        const stringPromise = LazyPromise.reject('string error')
        const objectPromise = LazyPromise.reject({ code: 500, message: 'server error' })

        await expect(errorPromise).rejects.toBeInstanceOf(Error)
        await expect(stringPromise).rejects.toBe('string error')
        await expect(objectPromise).rejects.toEqual({ code: 500, message: 'server error' })
      })
    })
  })

  describe('instance methods', () => {
    describe('then()', () => {
      test('executes lazily when then is called', async () => {
        const execute = vi.fn((resolve: (value: string) => void) => {
          resolve('OK')
        })
        const promise = new LazyPromise(execute)

        // Should not execute immediately
        expect(execute).not.toHaveBeenCalled()

        // Should execute when then is called
        const result = promise.then((value) => `result: ${value}`)
        await expect(result).resolves.toBe('result: OK')
        expect(execute).toHaveBeenCalledTimes(1)
      })

      test('only executes once even with multiple then calls', async () => {
        const execute = vi.fn((resolve: (value: string) => void) => {
          resolve('OK')
        })
        const promise = new LazyPromise(execute)

        const result1 = promise.then((value) => `first: ${value}`)
        const result2 = promise.then((value) => `second: ${value}`)

        await expect(result1).resolves.toBe('first: OK')
        await expect(result2).resolves.toBe('second: OK')
        expect(execute).toHaveBeenCalledTimes(1)
      })

      test('handles onFulfilled and onRejected callbacks', async () => {
        const resolvePromise = new LazyPromise<string>((resolve) => resolve('success'))
        const rejectPromise = new LazyPromise<string>((_, reject) => reject('error'))

        const successResult = resolvePromise.then(
          (value) => `handled: ${value}`,
          (error) => `caught: ${error}`,
        )
        const errorResult = rejectPromise.then(
          (value) => `handled: ${value}`,
          (error) => `caught: ${error}`,
        )

        await expect(successResult).resolves.toBe('handled: success')
        await expect(errorResult).resolves.toBe('caught: error')
      })

      test('handles null callbacks', async () => {
        const promise = new LazyPromise<string>((resolve) => resolve('OK'))
        const result = promise.then(null, null)
        await expect(result).resolves.toBe('OK')
      })
    })

    describe('catch()', () => {
      test('executes lazily when catch is called', async () => {
        const execute = vi.fn((_: (value: string) => void, reject: (reason: unknown) => void) => {
          reject('failed')
        })
        const promise = new LazyPromise(execute)

        expect(execute).not.toHaveBeenCalled()

        const result = promise.catch((error) => `caught: ${error}`)
        await expect(result).resolves.toBe('caught: failed')
        expect(execute).toHaveBeenCalledTimes(1)
      })

      test('only executes once even with multiple catch calls', async () => {
        const execute = vi.fn((_: (value: string) => void, reject: (reason: unknown) => void) => {
          reject('failed')
        })
        const promise = new LazyPromise(execute)

        const result1 = promise.catch((error) => `first: ${error}`)
        const result2 = promise.catch((error) => `second: ${error}`)

        await expect(result1).resolves.toBe('first: failed')
        await expect(result2).resolves.toBe('second: failed')
        expect(execute).toHaveBeenCalledTimes(1)
      })

      test('handles null callback', async () => {
        const promise = new LazyPromise<string>((_, reject) => reject('error'))
        const result = promise.catch(null)
        await expect(result).rejects.toBe('error')
      })

      test('passes through resolved values when no error occurs', async () => {
        const promise = new LazyPromise<string>((resolve) => resolve('success'))
        const result = promise.catch((error) => `caught: ${error}`)
        await expect(result).resolves.toBe('success')
      })
    })

    describe('finally()', () => {
      test('executes lazily when finally is called', async () => {
        const execute = vi.fn((resolve: (value: string) => void) => {
          resolve('OK')
        })
        const finallyCallback = vi.fn(() => {})
        const promise = new LazyPromise(execute)

        expect(execute).not.toHaveBeenCalled()

        const result = promise.finally(finallyCallback)
        await expect(result).resolves.toBe('OK')
        expect(execute).toHaveBeenCalledTimes(1)
        expect(finallyCallback).toHaveBeenCalledTimes(1)
      })

      test('only executes once even with multiple finally calls', async () => {
        const execute = vi.fn((resolve: (value: string) => void) => {
          resolve('OK')
        })
        const finallyCallback = vi.fn(() => {})
        const promise = new LazyPromise(execute)

        const result1 = promise.finally(finallyCallback)
        const result2 = promise.finally(finallyCallback)

        await expect(result1).resolves.toBe('OK')
        await expect(result2).resolves.toBe('OK')
        expect(execute).toHaveBeenCalledTimes(1)
        expect(finallyCallback).toHaveBeenCalledTimes(2)
      })

      test('calls finally callback for both resolved and rejected promises', async () => {
        const resolveCallback = vi.fn(() => {})
        const rejectCallback = vi.fn(() => {})

        const resolvePromise = new LazyPromise<string>((resolve) => resolve('success'))
        const rejectPromise = new LazyPromise<string>((_, reject) => reject('error'))

        await resolvePromise.finally(resolveCallback)
        await rejectPromise.finally(rejectCallback).catch(() => {})

        expect(resolveCallback).toHaveBeenCalledTimes(1)
        expect(rejectCallback).toHaveBeenCalledTimes(1)
      })

      test('handles null callback', async () => {
        const promise = new LazyPromise<string>((resolve) => resolve('OK'))
        const result = promise.finally(null)
        await expect(result).resolves.toBe('OK')
      })

      test('preserves rejection when finally callback throws', async () => {
        const promise = new LazyPromise<string>((_, reject) => reject('original error'))
        const result = promise.finally(() => {
          throw new Error('finally error')
        })
        await expect(result).rejects.toBeInstanceOf(Error)
        await expect(result).rejects.toHaveProperty('message', 'finally error')
      })
    })
  })

  describe('constructor', () => {
    test('creates a LazyPromise instance', () => {
      const execute = vi.fn()
      const promise = new LazyPromise(execute)
      expect(promise).toBeInstanceOf(LazyPromise)
      expect(promise).toBeInstanceOf(Promise)
    })

    test('does not execute immediately upon construction', () => {
      const execute = vi.fn()
      new LazyPromise(execute)
      expect(execute).not.toHaveBeenCalled()
    })
  })

  describe('lazy execution behavior', () => {
    test('executes only when a promise method is called', async () => {
      const execute = vi.fn((resolve: (value: string) => void) => {
        resolve('executed')
      })
      const promise = new LazyPromise(execute)

      // Wait a bit to ensure no automatic execution
      await sleep(100)
      expect(execute).not.toHaveBeenCalled()

      // Execute when then is called
      await promise.then()
      expect(execute).toHaveBeenCalledTimes(1)
    })

    test('maintains lazy behavior across different promise methods', async () => {
      const execute = vi.fn((resolve: (value: string) => void) => {
        resolve('OK')
      })
      const promise = new LazyPromise(execute)

      // Call different methods, should only execute once
      const thenResult = promise.then()
      const catchResult = promise.catch()
      const finallyResult = promise.finally()

      await Promise.all([thenResult, catchResult, finallyResult])
      expect(execute).toHaveBeenCalledTimes(1)
    })
  })
})

describe('lazy()', () => {
  test('executes lazily', async () => {
    const execute = vi.fn(() => {
      return Promise.resolve('OK')
    })
    const call = lazy(execute)
    await sleep(500)
    await expect(call).resolves.toBe('OK')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('only calls the execute function if needed', () => {
    const execute = vi.fn(() => Promise.resolve())
    lazy(execute)
    expect(execute).not.toHaveBeenCalled()
  })

  test('calls the execute function at most once', async () => {
    const execute = vi.fn(() => Promise.resolve('OK'))
    const call = lazy(execute)
    const res1 = await call
    const res2 = call.then((value) => `value: ${value}`)
    expect(res1).toBe('OK')
    await expect(res2).resolves.toBe('value: OK')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  test('throws errors', async () => {
    const execute = vi.fn(() => Promise.reject('failed'))
    const call = lazy(execute)
    await expect(call).rejects.toBe('failed')
    const res = call.then(
      () => 'success',
      (err) => Promise.reject(`error: ${err}`),
    )
    await expect(res).rejects.toBe('error: failed')
  })
})
