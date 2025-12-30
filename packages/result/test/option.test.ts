import { describe, expect, test } from 'vitest'

import { Option } from '../src/option.js'

describe('Option', () => {
  describe('static methods', () => {
    describe('Option.some', () => {
      test('creates an Option with a value', () => {
        const option = Option.some('test')
        expect(option.isSome()).toBe(true)
        expect(option.orNull).toBe('test')
      })

      test('creates an Option with null value', () => {
        const option = Option.some(null)
        expect(option.isSome()).toBe(true)
        expect(option.orNull).toBe(null)
      })

      test('creates an Option with undefined value', () => {
        const option = Option.some(undefined)
        expect(option.isSome()).toBe(true)
        expect(option.orNull).toBe(undefined)
      })

      test('creates an Option with complex object', () => {
        const obj = { id: 1, name: 'test' }
        const option = Option.some(obj)
        expect(option.isSome()).toBe(true)
        expect(option.orNull).toBe(obj)
      })
    })

    describe('Option.none', () => {
      test('creates an Option without a value', () => {
        const option = Option.none()
        expect(option.isNone()).toBe(true)
        expect(option.orNull).toBe(null)
      })

      test('throws when accessing orThrow', () => {
        const option = Option.none()
        expect(() => option.orThrow).toThrow('Option is none')
      })
    })

    describe('Option.of', () => {
      test('creates Option.some for non-null values', () => {
        const result = Option.of('test')
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe('test')
      })

      test('creates Option.some for 0', () => {
        const result = Option.of(0)
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe(0)
      })

      test('creates Option.some for empty string', () => {
        const result = Option.of('')
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe('')
      })

      test('creates Option.some for false', () => {
        const result = Option.of(false)
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe(false)
      })

      test('creates Option.none for null', () => {
        const result = Option.of(null)
        expect(result.isNone()).toBe(true)
      })

      test('creates Option.none for undefined', () => {
        const result = Option.of(undefined)
        expect(result.isNone()).toBe(true)
      })
    })

    describe('Option.from', () => {
      test('returns the same Option if input is already an Option', () => {
        const original = Option.some('test')
        const result = Option.from(original)
        expect(result).toBe(original)
      })

      test('creates Option.some for non-null values', () => {
        const result = Option.from('test')
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe('test')
      })

      test('creates Option.some for 0', () => {
        const result = Option.from(0)
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe(0)
      })

      test('creates Option.some for empty string', () => {
        const result = Option.from('')
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe('')
      })

      test('creates Option.some for false', () => {
        const result = Option.from(false)
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe(false)
      })

      test('creates Option.none for null', () => {
        const result = Option.from(null)
        expect(result.isNone()).toBe(true)
      })

      test('creates Option.none for undefined', () => {
        const result = Option.from(undefined)
        expect(result.isNone()).toBe(true)
      })
    })

    describe('Option.is', () => {
      test('returns true for Option instances', () => {
        const option = Option.some('test')
        expect(Option.is(option)).toBe(true)
      })

      test('returns false for non-Option values', () => {
        expect(Option.is('test')).toBe(false)
        expect(Option.is(null)).toBe(false)
        expect(Option.is(undefined)).toBe(false)
        expect(Option.is({})).toBe(false)
        expect(Option.is([])).toBe(false)
      })
    })
  })

  describe('instance methods', () => {
    describe('isSome', () => {
      test('returns true for Option.some', () => {
        const option = Option.some('test')
        expect(option.isSome()).toBe(true)
      })

      test('returns false for Option.none', () => {
        const option = Option.none()
        expect(option.isNone()).toBe(true)
      })

      test('acts as type guard', () => {
        const option: Option<string> = Option.some('test')
        if (option.isSome()) {
          // TypeScript should know this is safe
          expect(option.orNull).toBe('test')
        }
      })
    })

    describe('isNone', () => {
      test('returns false for Option.some', () => {
        const option = Option.some('test')
        expect(option.isNone()).toBe(false)
      })

      test('returns true for Option.none', () => {
        const option = Option.none()
        expect(option.isNone()).toBe(true)
      })

      test('acts as type guard', () => {
        const option: Option<string> = Option.none()
        if (option.isNone()) {
          // TypeScript should know this is safe
          expect(option.orNull).toBe(null)
        }
      })
    })

    describe('orNull', () => {
      test('returns value for Option.some', () => {
        const option = Option.some('test')
        expect(option.orNull).toBe('test')
      })

      test('returns null for Option.none', () => {
        const option = Option.none()
        expect(option.orNull).toBe(null)
      })

      test('returns null for Option.some(null)', () => {
        const option = Option.some(null)
        expect(option.orNull).toBe(null)
      })
    })

    describe('orThrow', () => {
      test('returns value for Option.some', () => {
        const option = Option.some('test')
        expect(option.orThrow).toBe('test')
      })

      test('throws error for Option.none', () => {
        const option = Option.none()
        expect(() => option.orThrow).toThrow('Option is none')
      })
    })

    describe('or', () => {
      test('returns value for Option.some', () => {
        const option = Option.some('test')
        expect(option.or('default')).toBe('test')
      })

      test('returns default for Option.none', () => {
        const option = Option.none()
        expect(option.or('default')).toBe('default')
      })

      test('returns default for Option.none with complex default', () => {
        const option = Option.none<{ id: number; name: string }>()
        const defaultObj = { id: 1, name: 'default' }
        expect(option.or(defaultObj)).toBe(defaultObj)
      })
    })

    describe('map', () => {
      test('applies function to value for Option.some', () => {
        const option = Option.some('test')
        const result = option.map((value) => value.toUpperCase())
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe('TEST')
      })

      test('returns Option.none for Option.none', () => {
        const option = Option.none<string>()
        const result = option.map((value) => value.toUpperCase())
        expect(result.isNone()).toBe(true)
      })

      test('handles function returning Option', () => {
        const option = Option.some('test')
        const result = option.map((value) => Option.some(value.toUpperCase()))
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toBe('TEST')
      })

      test('handles function returning Option.none', () => {
        const option = Option.some('test')
        const result = option.map(() => Option.none<string>())
        expect(result.isNone()).toBe(true)
      })

      test('handles complex transformation', () => {
        const option = Option.some({ id: 1, name: 'test' })
        const result = option.map((obj) => ({ ...obj, name: obj.name.toUpperCase() }))
        expect(result.isSome()).toBe(true)
        expect(result.orNull).toEqual({ id: 1, name: 'TEST' })
      })
    })
  })

  describe('edge cases and integration', () => {
    test('chaining map operations', () => {
      const option = Option.some('hello world')
      const result = option
        .map((str) => str.split(' '))
        .map((words) => words.join('-'))
        .map((str) => str.toUpperCase())

      expect(result.isSome()).toBe(true)
      expect(result.orNull).toBe('HELLO-WORLD')
    })

    test('chaining with Option.none in middle', () => {
      const option = Option.some('hello world')
      const result = option
        .map((str) => str.split(' '))
        .map(() => Option.none<Array<string>>())
        .map((words) => words.join('-'))

      expect(result.isNone()).toBe(true)
    })

    test('or with different types', () => {
      const option = Option.none<number>()
      const result = option.or(42)
      expect(result).toBe(42)
    })

    test('map with different return types', () => {
      const option = Option.some('123')
      const result = option.map((str) => Number.parseInt(str, 10))
      expect(result.isSome()).toBe(true)
      expect(result.orNull).toBe(123)
    })

    test('Option.some with falsy values', () => {
      expect(Option.some(0).isSome()).toBe(true)
      expect(Option.some('').isSome()).toBe(true)
      expect(Option.some(false).isSome()).toBe(true)
      expect(Option.some(Number.NaN).isSome()).toBe(true)
    })

    test('Option.of with falsy values', () => {
      expect(Option.of(0).isSome()).toBe(true)
      expect(Option.of('').isSome()).toBe(true)
      expect(Option.of(false).isSome()).toBe(true)
      expect(Option.of(Number.NaN).isSome()).toBe(true)
    })
  })
})
