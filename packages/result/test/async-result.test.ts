import { AsyncResult } from '../src/async-result.js'
import { Result } from '../src/result.js'

describe('AsyncResult', () => {
  describe('static methods', () => {
    describe('AsyncResult.ok', () => {
      test('creates an AsyncResult with a value', async () => {
        const asyncResult = AsyncResult.ok('test')
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('test')
      })

      test('creates an AsyncResult with null value', async () => {
        const asyncResult = AsyncResult.ok(null)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(null)
      })

      test('creates an AsyncResult with undefined value', async () => {
        const asyncResult = AsyncResult.ok(undefined)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(undefined)
      })

      test('creates an AsyncResult with complex object', async () => {
        const obj = { id: 1, name: 'test' }
        const asyncResult = AsyncResult.ok(obj)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(obj)
      })

      test('creates an AsyncResult with number', async () => {
        const asyncResult = AsyncResult.ok(42)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(42)
      })

      test('creates an AsyncResult with boolean', async () => {
        const asyncResult = AsyncResult.ok(true)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(true)
      })
    })

    describe('AsyncResult.error', () => {
      test('creates an AsyncResult with an error', async () => {
        const error = new Error('test error')
        const result = await AsyncResult.error(error)
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })

      test('creates an AsyncResult with custom error type', async () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('custom error')
        const result = await AsyncResult.error(error)
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })

      test('creates an AsyncResult with TypeError', async () => {
        const error = new TypeError('type error')
        const result = await AsyncResult.error(error)
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })
    })

    describe('AsyncResult.resolve', () => {
      test('resolves a simple value', async () => {
        const asyncResult = AsyncResult.resolve('test')
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('test')
      })

      test('resolves a Promise', async () => {
        const asyncResult = AsyncResult.resolve(Promise.resolve('test'))
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('test')
      })

      test('resolves null', async () => {
        const asyncResult = AsyncResult.resolve(null)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(null)
      })

      test('resolves undefined', async () => {
        const asyncResult = AsyncResult.resolve(undefined)
        const result = await asyncResult
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(undefined)
      })

      test('resolves falsy values', async () => {
        expect((await AsyncResult.resolve(0)).isOK()).toBe(true)
        expect((await AsyncResult.resolve('')).isOK()).toBe(true)
        expect((await AsyncResult.resolve(false)).isOK()).toBe(true)
        expect((await AsyncResult.resolve(Number.NaN)).isOK()).toBe(true)
      })

      test('handles rejected Promise', async () => {
        const error = new Error('rejected error')
        const result = await AsyncResult.resolve(Promise.reject(error))
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })
    })

    describe('AsyncResult.reject', () => {
      test('rejects with an error', async () => {
        const error = new Error('reject error')
        const result = await AsyncResult.reject(error)
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })

      test('rejects with custom error type', async () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('custom reject error')
        const result = await AsyncResult.reject(error)
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })
    })

    describe('AsyncResult.from', () => {
      test('returns the same AsyncResult if input is already an AsyncResult', async () => {
        const original = AsyncResult.ok('test')
        const result = AsyncResult.from(original)
        expect(result).toBe(original)
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe('test')
      })

      test('creates AsyncResult.ok for non-error values', async () => {
        const result = AsyncResult.from('test')
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe('test')
      })

      test('creates AsyncResult.ok for null', async () => {
        const result = AsyncResult.from(null)
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe(null)
      })

      test('creates AsyncResult.ok for undefined', async () => {
        const result = AsyncResult.from(undefined)
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe(undefined)
      })

      test('creates AsyncResult.ok for 0', async () => {
        const result = AsyncResult.from(0)
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe(0)
      })

      test('creates AsyncResult.ok for empty string', async () => {
        const result = AsyncResult.from('')
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe('')
      })

      test('creates AsyncResult.ok for false', async () => {
        const result = AsyncResult.from(false)
        const resolved = await result
        expect(resolved.isOK()).toBe(true)
        expect(resolved.value).toBe(false)
      })

      test('creates AsyncResult.error for Error instances', async () => {
        const error = new Error('test error')
        const result = AsyncResult.from(error)
        const resolved = await result
        expect(resolved.isError()).toBe(true)
        expect(() => resolved.value).toThrow('test error')
      })

      test('creates AsyncResult.error for custom error types', async () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('custom error')
        const result = AsyncResult.from(error)
        const resolved = await result
        expect(resolved.isError()).toBe(true)
        expect(() => resolved.value).toThrow('custom error')
      })
    })

    describe('AsyncResult.is', () => {
      test('returns true for AsyncResult instances', () => {
        const asyncResult = AsyncResult.ok('test')
        expect(AsyncResult.is(asyncResult)).toBe(true)
      })

      test('returns true for error AsyncResult instances', () => {
        const asyncResult = AsyncResult.error(new Error('test'))
        expect(AsyncResult.is(asyncResult)).toBe(true)
      })

      test('returns false for non-AsyncResult values', () => {
        expect(AsyncResult.is('test')).toBe(false)
        expect(AsyncResult.is(null)).toBe(false)
        expect(AsyncResult.is(undefined)).toBe(false)
        expect(AsyncResult.is({})).toBe(false)
        expect(AsyncResult.is([])).toBe(false)
        expect(AsyncResult.is(new Error('test'))).toBe(false)
        expect(AsyncResult.is(Promise.resolve('test'))).toBe(false)
      })
    })

    describe('AsyncResult.all', () => {
      test('resolves all successful values', async () => {
        const values = ['a', 'b', 'c']
        const result = await AsyncResult.all(values)
        expect(result.isOK()).toBe(true)
        const asyncResults = result.value
        expect(asyncResults).toHaveLength(3)
        expect(await asyncResults[0]).toEqual(Result.ok('a'))
        expect(await asyncResults[1]).toEqual(Result.ok('b'))
        expect(await asyncResults[2]).toEqual(Result.ok('c'))
      })

      test('handles mixed success and failure', async () => {
        const values = ['a', Promise.reject(new Error('test error')), 'c']
        const result = await AsyncResult.all(values)
        expect(result.isOK()).toBe(true)
        const asyncResults = result.value
        expect(asyncResults).toHaveLength(3)
        expect(await asyncResults[0]).toEqual(Result.ok('a'))
        expect(await asyncResults[1]).toEqual(Result.error(new Error('test error')))
        expect(await asyncResults[2]).toEqual(Result.ok('c'))
      })

      test('handles all failures', async () => {
        const error1 = new Error('error 1')
        const error2 = new Error('error 2')
        const values = [Promise.reject(error1), Promise.reject(error2)]
        const result = await AsyncResult.all(values)
        expect(result.isOK()).toBe(true)
        const asyncResults = result.value
        expect(asyncResults).toHaveLength(2)
        expect(await asyncResults[0]).toEqual(Result.error(error1))
        expect(await asyncResults[1]).toEqual(Result.error(error2))
      })

      test('handles empty array', async () => {
        const result = await AsyncResult.all([])
        expect(result.isOK()).toBe(true)
        expect(result.value).toEqual([])
      })
    })
  })

  describe('instance methods', () => {
    describe('optional', () => {
      test('returns Option.some for AsyncResult.ok', async () => {
        const asyncResult = AsyncResult.ok('test')
        const option = await asyncResult.optional
        expect(option.isSome()).toBe(true)
        expect(option.valueOrNull).toBe('test')
      })

      test('returns Option.none for AsyncResult.error', async () => {
        const asyncResult = AsyncResult.error(new Error('test'))
        const option = await asyncResult.optional
        expect(option.isNone()).toBe(true)
      })

      test('returns Option.some for AsyncResult.ok with null', async () => {
        const asyncResult = AsyncResult.ok(null)
        const option = await asyncResult.optional
        expect(option.isSome()).toBe(true)
        expect(option.valueOrNull).toBe(null)
      })

      test('returns Option.some for AsyncResult.ok with undefined', async () => {
        const asyncResult = AsyncResult.ok(undefined)
        const option = await asyncResult.optional
        expect(option.isSome()).toBe(true)
        expect(option.valueOrNull).toBe(undefined)
      })
    })

    describe('resolvedOr', () => {
      test('returns value for AsyncResult.ok', async () => {
        const asyncResult = AsyncResult.ok('test')
        const value = await asyncResult.resolvedOr('default')
        expect(value).toBe('test')
      })

      test('returns default value for AsyncResult.error', async () => {
        const asyncResult = AsyncResult.error(new Error('test'))
        const result = await asyncResult.resolvedOr('default')
        expect(result).toBe('default')
      })

      test('returns async default value for AsyncResult.error', async () => {
        const asyncResult = AsyncResult.error(new Error('test'))
        const result = await asyncResult.resolvedOr(Promise.resolve('async default'))
        expect(result).toBe('async default')
      })

      test('handles complex default values', async () => {
        const asyncResult = AsyncResult.error(new Error('test'))
        const defaultObj = { id: 1, name: 'default' }
        const result = await asyncResult.resolvedOr(defaultObj)
        expect(result).toEqual(defaultObj)
      })
    })

    describe('map', () => {
      test('applies function to value for AsyncResult.ok', async () => {
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map((value) => value.toUpperCase())
        const result = await mapped
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('TEST')
      })

      test('returns AsyncResult.error for AsyncResult.error', async () => {
        const error = new Error('test')
        const asyncResult = AsyncResult.error<string>(error)
        const mapped = asyncResult.map((value) => value.toUpperCase())
        const result = await mapped
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })

      test('handles function returning Promise', async () => {
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map((value) => Promise.resolve(value.toUpperCase()))
        const result = await mapped
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('TEST')
      })

      test('handles function returning Result.ok', async () => {
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map((value) => Result.ok(value.toUpperCase()))
        const result = await mapped
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('TEST')
      })

      test('handles function returning Result.error', async () => {
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map(() => Result.error(new Error('mapped error')))
        const result = await mapped
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('mapped error')
      })

      test('handles function returning AsyncResult.ok', async () => {
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map((value) => AsyncResult.ok(value.toUpperCase()))
        const result = await mapped
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('TEST')
      })

      test('handles function returning AsyncResult.error', async () => {
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map(() => AsyncResult.error(new Error('async mapped error')))
        const result = await mapped
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('async mapped error')
      })

      test('handles function throwing error', async () => {
        const error = new Error('thrown error')
        const asyncResult = AsyncResult.ok('test')
        const mapped = asyncResult.map(() => {
          throw error
        })
        const result = await mapped
        expect(result.isError()).toBe(true)
        expect(result.error).toBe(error)
      })

      test('handles complex transformation', async () => {
        const asyncResult = AsyncResult.ok({ id: 1, name: 'test' })
        const mapped = asyncResult.map((obj) => ({ ...obj, name: obj.name.toUpperCase() }))
        const result = await mapped
        expect(result.isOK()).toBe(true)
        expect(result.value).toEqual({ id: 1, name: 'TEST' })
      })

      test('preserves error type when mapping error result', async () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const asyncResult = AsyncResult.error<string>(new CustomError('custom error'))
        const mapped = asyncResult.map((value) => value.toUpperCase())
        const result = await mapped
        expect(result.isError()).toBe(true)
        expect(result.error).toBeInstanceOf(CustomError)
      })

      test('handles async function with different return types', async () => {
        const asyncResult = AsyncResult.ok('123')
        const mapped = asyncResult.map((str) => Promise.resolve(Number.parseInt(str, 10)))
        const result = await mapped
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(123)
      })
    })
  })

  describe('edge cases and integration', () => {
    test('chaining map operations', async () => {
      const asyncResult = AsyncResult.ok('hello world')
      const mapped = asyncResult
        .map((str) => str.split(' '))
        .map((words) => words.join('-'))
        .map((str) => str.toUpperCase())

      const result = await mapped
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('HELLO-WORLD')
    })

    test('chaining with AsyncResult.error in middle', async () => {
      const asyncResult = AsyncResult.ok('hello world')
      const mapped = asyncResult
        .map((str) => str.split(' '))
        .map(() => AsyncResult.error<Array<string>>(new Error('middle error')))
        .map((words) => words.join('-'))
      const result = await mapped
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(Error)
    })

    test('chaining with thrown error in middle', async () => {
      const error = new Error('thrown middle error')
      const asyncResult = AsyncResult.ok('hello world')
      const mapped = asyncResult
        .map((str) => str.split(' '))
        .map(() => {
          throw error
        })
        .map((words: Array<string>) => words.join('-'))

      const result = await mapped
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('map with different return types', async () => {
      const asyncResult = AsyncResult.ok('123')
      const mapped = asyncResult.map((str) => Number.parseInt(str, 10))
      const result = await mapped
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe(123)
    })

    test('map with async-like operations', async () => {
      const asyncResult = AsyncResult.ok({ id: 1, data: 'test' })
      const mapped = asyncResult.map((obj) => ({ ...obj, processed: true }))
      const result = await mapped
      expect(result.isOK()).toBe(true)
      expect(result.value).toEqual({ id: 1, data: 'test', processed: true })
    })

    test('AsyncResult.ok with falsy values', async () => {
      expect((await AsyncResult.ok(0)).isOK()).toBe(true)
      expect((await AsyncResult.ok('')).isOK()).toBe(true)
      expect((await AsyncResult.ok(false)).isOK()).toBe(true)
      expect((await AsyncResult.ok(Number.NaN)).isOK()).toBe(true)
    })

    test('AsyncResult.from with falsy values', async () => {
      expect((await AsyncResult.from(0)).isOK()).toBe(true)
      expect((await AsyncResult.from('')).isOK()).toBe(true)
      expect((await AsyncResult.from(false)).isOK()).toBe(true)
      expect((await AsyncResult.from(Number.NaN)).isOK()).toBe(true)
    })

    test('optional property with complex objects', async () => {
      const complexObj = { id: 1, nested: { value: 'test' } }
      const asyncResult = AsyncResult.ok(complexObj)
      const option = await asyncResult.optional
      expect(option.isSome()).toBe(true)
      expect(option.valueOrNull).toBe(complexObj)
    })

    test('error propagation through map chain', async () => {
      const asyncResult = AsyncResult.error<string>(new Error('initial error'))
      const mapped = asyncResult
        .map((value) => value.toUpperCase())
        .map((value) => value.split(''))
        .map((chars) => chars.join('-'))

      const result = await mapped
      expect(result.isError()).toBe(true)
      expect(result.error).toBeInstanceOf(Error)
    })

    test('type safety with generic constraints', async () => {
      const asyncResult: AsyncResult<string, Error> = AsyncResult.ok('test')
      const result = await asyncResult
      if (result.isOK()) {
        expect(result.value).toBe('test')
      }
    })

    test('Promise-like behavior', async () => {
      const asyncResult = AsyncResult.ok('test')
      const result = await asyncResult
      expect(result.isOK()).toBe(true)
      expect(result.value).toBe('test')
    })

    test('handles rejected promises in constructor', async () => {
      const error = new Error('constructor error')
      const asyncResult = new AsyncResult(Promise.reject(Result.error(error)))
      const result = await asyncResult
      expect(result.isError()).toBe(true)
      expect(result.error).toBe(error)
    })

    test('Symbol.species behavior', () => {
      const asyncResult = AsyncResult.ok('test')
      expect((asyncResult.constructor as any)[Symbol.species]).toBe(Promise)
    })
  })
})
