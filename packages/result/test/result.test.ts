import { Result } from '../src/result.js'

describe('Result', () => {
  describe('static methods', () => {
    describe('Result.ok', () => {
      test('creates a Result with a value', () => {
        const result = Result.ok('test')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('test')
      })

      test('creates a Result with null value', () => {
        const result = Result.ok(null)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(null)
      })

      test('creates a Result with undefined value', () => {
        const result = Result.ok(undefined)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(undefined)
      })

      test('creates a Result with complex object', () => {
        const obj = { id: 1, name: 'test' }
        const result = Result.ok(obj)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(obj)
      })

      test('creates a Result with number', () => {
        const result = Result.ok(42)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(42)
      })

      test('creates a Result with boolean', () => {
        const result = Result.ok(true)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(true)
      })
    })

    describe('Result.error', () => {
      test('creates a Result with an error', () => {
        const error = new Error('test error')
        const result = Result.error(error)
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('test error')
      })

      test('creates a Result with custom error type', () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('custom error')
        const result = Result.error(error)
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('custom error')
      })

      test('creates a Result with TypeError', () => {
        const error = new TypeError('type error')
        const result = Result.error(error)
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('type error')
      })
    })

    describe('Result.from', () => {
      test('returns the same Result if input is already a Result', () => {
        const original = Result.ok('test')
        const result = Result.from(original)
        expect(result).toBe(original)
      })

      test('creates Result.ok for non-error values', () => {
        const result = Result.from('test')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('test')
      })

      test('creates Result.ok for null', () => {
        const result = Result.from(null)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(null)
      })

      test('creates Result.ok for undefined', () => {
        const result = Result.from(undefined)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(undefined)
      })

      test('creates Result.ok for 0', () => {
        const result = Result.from(0)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(0)
      })

      test('creates Result.ok for empty string', () => {
        const result = Result.from('')
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe('')
      })

      test('creates Result.ok for false', () => {
        const result = Result.from(false)
        expect(result.isOK()).toBe(true)
        expect(result.value).toBe(false)
      })

      test('creates Result.error for Error instances', () => {
        const error = new Error('test error')
        const result = Result.from(error)
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('test error')
      })

      test('creates Result.error for custom error types', () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const error = new CustomError('custom error')
        const result = Result.from(error)
        expect(result.isError()).toBe(true)
        expect(() => result.value).toThrow('custom error')
      })
    })

    describe('Result.is', () => {
      test('returns true for Result instances', () => {
        const result = Result.ok('test')
        expect(Result.is(result)).toBe(true)
      })

      test('returns true for error Result instances', () => {
        const result = Result.error(new Error('test'))
        expect(Result.is(result)).toBe(true)
      })

      test('returns false for non-Result values', () => {
        expect(Result.is('test')).toBe(false)
        expect(Result.is(null)).toBe(false)
        expect(Result.is(undefined)).toBe(false)
        expect(Result.is({})).toBe(false)
        expect(Result.is([])).toBe(false)
        expect(Result.is(new Error('test'))).toBe(false)
      })
    })
  })

  describe('instance methods', () => {
    describe('isOK', () => {
      test('returns true for Result.ok', () => {
        const result = Result.ok('test')
        expect(result.isOK()).toBe(true)
      })

      test('returns false for Result.error', () => {
        const result = Result.error(new Error('test'))
        expect(result.isOK()).toBe(false)
      })

      test('acts as type guard', () => {
        const result: Result<string, Error> = Result.ok('test')
        if (result.isOK()) {
          // TypeScript should know this is safe
          expect(result.value).toBe('test')
        }
      })
    })

    describe('isError', () => {
      test('returns false for Result.ok', () => {
        const result = Result.ok('test')
        expect(result.isError()).toBe(false)
      })

      test('returns true for Result.error', () => {
        const result = Result.error(new Error('test'))
        expect(result.isError()).toBe(true)
      })

      test('acts as type guard', () => {
        const result: Result<string, Error> = Result.error(new Error('test'))
        if (result.isError()) {
          // TypeScript should know this is safe
          expect(() => result.value).toThrow('test')
        }
      })
    })

    describe('optional', () => {
      test('returns Option.some for Result.ok', () => {
        const result = Result.ok('test')
        const option = result.optional
        expect(option.isSome()).toBe(true)
        expect(option.valueOrNull).toBe('test')
      })

      test('returns Option.none for Result.error', () => {
        const result = Result.error(new Error('test'))
        const option = result.optional
        expect(option.isNone()).toBe(true)
      })

      test('returns Option.some for Result.ok with null', () => {
        const result = Result.ok(null)
        const option = result.optional
        expect(option.isSome()).toBe(true)
        expect(option.valueOrNull).toBe(null)
      })

      test('returns Option.some for Result.ok with undefined', () => {
        const result = Result.ok(undefined)
        const option = result.optional
        expect(option.isSome()).toBe(true)
        expect(option.valueOrNull).toBe(undefined)
      })
    })

    describe('value', () => {
      test('returns value for Result.ok', () => {
        const result = Result.ok('test')
        expect(result.value).toBe('test')
      })

      test('throws error for Result.error', () => {
        const error = new Error('test error')
        const result = Result.error(error)
        expect(() => result.value).toThrow('test error')
      })

      test('throws the exact error instance for Result.error', () => {
        const error = new Error('test error')
        const result = Result.error(error)
        expect(() => result.value).toThrow(error)
      })
    })

    describe('map', () => {
      test('applies function to value for Result.ok', () => {
        const result = Result.ok('test')
        const mapped = result.map((value) => value.toUpperCase())
        expect(mapped.isOK()).toBe(true)
        expect(mapped.value).toBe('TEST')
      })

      test('returns Result.error for Result.error', () => {
        const result = Result.error(new Error('test'))
        // @ts-expect-error - value is never
        const mapped = result.map((value) => value.toUpperCase())
        expect(mapped.isError()).toBe(true)
        expect(() => mapped.value).toThrow('test')
      })

      test('handles function returning Result.ok', () => {
        const result = Result.ok('test')
        const mapped = result.map((value) => Result.ok(value.toUpperCase()))
        expect(mapped.isOK()).toBe(true)
        expect(mapped.value).toBe('TEST')
      })

      test('handles function returning Result.error', () => {
        const result = Result.ok('test')
        const mapped = result.map(() => Result.error(new Error('mapped error')))
        expect(mapped.isError()).toBe(true)
        expect(() => mapped.value).toThrow('mapped error')
      })

      test('handles function throwing error', () => {
        const result = Result.ok('test')
        const mapped = result.map(() => {
          throw new Error('thrown error')
        })
        expect(mapped.isError()).toBe(true)
        expect(() => mapped.value).toThrow('thrown error')
      })

      test('handles complex transformation', () => {
        const result = Result.ok({ id: 1, name: 'test' })
        const mapped = result.map((obj) => ({ ...obj, name: obj.name.toUpperCase() }))
        expect(mapped.isOK()).toBe(true)
        expect(mapped.value).toEqual({ id: 1, name: 'TEST' })
      })

      test('preserves error type when mapping error result', () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message)
            this.name = 'CustomError'
          }
        }
        const result = Result.error(new CustomError('custom error'))
        // @ts-expect-error - value is never
        const mapped = result.map((value) => value.toUpperCase())
        expect(mapped.isError()).toBe(true)
        expect(() => mapped.value).toThrow('custom error')
        expect(() => mapped.value).toThrow(CustomError)
      })
    })
  })

  describe('edge cases and integration', () => {
    test('chaining map operations', () => {
      const result = Result.ok('hello world')
      const mapped = result
        .map((str) => str.split(' '))
        .map((words) => words.join('-'))
        .map((str) => str.toUpperCase())

      expect(mapped.isOK()).toBe(true)
      expect(mapped.value).toBe('HELLO-WORLD')
    })

    test('chaining with Result.error in middle', () => {
      const result = Result.ok('hello world')
      const mapped = result
        .map((str) => str.split(' '))
        .map(() => Result.error(new Error('middle error')))
        // @ts-expect-error - value is never
        .map((words) => words.join('-'))

      expect(mapped.isError()).toBe(true)
      expect(() => mapped.value).toThrow('middle error')
    })

    test('chaining with thrown error in middle', () => {
      const result = Result.ok('hello world')
      const mapped = result
        .map((str) => str.split(' '))
        .map(() => {
          throw new Error('thrown middle error')
        })
        // @ts-expect-error - value is never
        .map((words) => words.join('-'))

      expect(mapped.isError()).toBe(true)
      expect(() => mapped.value).toThrow('thrown middle error')
    })

    test('map with different return types', () => {
      const result = Result.ok('123')
      const mapped = result.map((str) => Number.parseInt(str, 10))
      expect(mapped.isOK()).toBe(true)
      expect(mapped.value).toBe(123)
    })

    test('map with async-like operations', () => {
      const result = Result.ok({ id: 1, data: 'test' })
      const mapped = result.map((obj) => ({ ...obj, processed: true }))
      expect(mapped.isOK()).toBe(true)
      expect(mapped.value).toEqual({ id: 1, data: 'test', processed: true })
    })

    test('Result.ok with falsy values', () => {
      expect(Result.ok(0).isOK()).toBe(true)
      expect(Result.ok('').isOK()).toBe(true)
      expect(Result.ok(false).isOK()).toBe(true)
      expect(Result.ok(Number.NaN).isOK()).toBe(true)
    })

    test('Result.from with falsy values', () => {
      expect(Result.from(0).isOK()).toBe(true)
      expect(Result.from('').isOK()).toBe(true)
      expect(Result.from(false).isOK()).toBe(true)
      expect(Result.from(Number.NaN).isOK()).toBe(true)
    })

    test('optional property with complex objects', () => {
      const complexObj = { id: 1, nested: { value: 'test' } }
      const result = Result.ok(complexObj)
      const option = result.optional
      expect(option.isSome()).toBe(true)
      expect(option.valueOrNull).toBe(complexObj)
    })

    test('error propagation through map chain', () => {
      const result = Result.error(new Error('initial error'))
      const mapped = result
        // @ts-expect-error - value is never
        .map((value) => value.toUpperCase())
        .map((value) => value.split(''))
        .map((chars) => chars.join('-'))

      expect(mapped.isError()).toBe(true)
      expect(() => mapped.value).toThrow('initial error')
    })

    test('type safety with generic constraints', () => {
      const result: Result<string, Error> = Result.ok('test')
      if (result.isOK()) {
        // Should be type-safe
        const value: string = result.value
        expect(value).toBe('test')
      }
    })
  })
})
