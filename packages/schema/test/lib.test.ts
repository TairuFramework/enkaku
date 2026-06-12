import { describe, expect, test } from 'vitest'

import {
  assertType,
  asType,
  createStandardValidator,
  createValidator,
  isType,
  toStandardValidator,
  ValidationError,
  ValidationErrorObject,
} from '../src/index.js'

describe('createValidator()', () => {
  test('creates a schema validation function', () => {
    const validator = createValidator({
      $id: 'test',
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    } as const)

    expect(assertType(validator, { test: true })).toBeUndefined()
    expect(() => assertType(validator, { test: false, extra: true })).toThrow()
    expect(isType(validator, { test: true })).toBe(true)
    expect(isType(validator, { test: false, extra: true })).toBe(false)

    const validateSuccess = validator({ test: true })
    expect(validateSuccess).toEqual({ value: { test: true } })

    const validateFailure = validator({ test: false, extra: true })
    expect(validateFailure).toBeInstanceOf(ValidationError)
  })

  test('createValidator does not mutate input object', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string', default: 'user' },
      },
      required: ['name'],
      additionalProperties: false,
    } as const
    const validator = createValidator(schema)
    const input = { name: 'test' }
    const inputCopy = { ...input }
    validator(input)
    expect(input).toEqual(inputCopy)
  })
})

describe('ValidationErrorObject', () => {
  test('fallback message does not expose schemaPath', () => {
    const errObj = new ValidationErrorObject({
      keyword: 'type',
      instancePath: '/test',
      schemaPath: '#/properties/test/type',
      params: { type: 'string' },
    } as never)
    expect(errObj.message).not.toContain('#/properties')
    expect(errObj.message).toContain('Validation failed')
  })
})

describe('asType()', () => {
  const validator = createValidator({
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false,
  } as const)

  test('returns value when validation passes', () => {
    const input = { name: 'test' }
    const result = asType(validator, input)
    expect(result).toEqual({ name: 'test' })
  })

  test('throws ValidationError when validation fails', () => {
    expect(() => asType(validator, { wrong: true })).toThrow(ValidationError)
  })
})

describe('toStandardValidator()', () => {
  test('wraps validator in StandardSchemaV1 structure', () => {
    const validator = createValidator({
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
      additionalProperties: false,
    } as const)

    const standard = toStandardValidator(validator)
    expect(standard['~standard'].version).toBe(1)
    expect(standard['~standard'].vendor).toBe('enkaku')
    expect(standard['~standard'].validate).toBe(validator)
  })

  test('standard validate returns value on success', () => {
    const validator = createValidator({
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
      additionalProperties: false,
    } as const)

    const standard = toStandardValidator(validator)
    const result = standard['~standard'].validate({ x: 42 })
    expect(result).toEqual({ value: { x: 42 } })
  })

  test('standard validate returns issues on failure', () => {
    const validator = createValidator({
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
      additionalProperties: false,
    } as const)

    const standard = toStandardValidator(validator)
    const result = standard['~standard'].validate({ x: 'not a number' })
    expect(result).toBeInstanceOf(ValidationError)
  })
})

describe('ValidatorOptions.strict', () => {
  // A valid 2020-12 construct that AJV strict mode warns about: a prefixItems
  // 2-tuple with no minItems/maxItems.
  const tupleSchema = {
    $id: 'https://example.com/strict-tuple',
    type: 'array',
    prefixItems: [{ type: 'string' }, { type: 'number' }],
  } as const

  function captureWarnings(fn: () => void): Array<string> {
    const warnings: Array<string> = []
    const original = console.warn
    console.warn = (...args: Array<unknown>) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      fn()
    } finally {
      console.warn = original
    }
    return warnings
  }

  test('emits a strict-mode warning by default', () => {
    const warnings = captureWarnings(() => {
      createValidator(tupleSchema, { draft: '2020-12' })
    })
    expect(warnings.some((w) => w.toLowerCase().includes('strict'))).toBe(true)
  })

  test('suppresses the strict-mode warning when strict is false', () => {
    const warnings = captureWarnings(() => {
      createValidator(tupleSchema, { draft: '2020-12', strict: false })
    })
    expect(warnings.some((w) => w.toLowerCase().includes('strict'))).toBe(false)
  })

  test('caches distinct AJV instances per strict value (no first-call-wins)', () => {
    // Default (strict) first, then strict:false for the same draft. If the cache
    // were keyed by draft only, the second call would reuse the strict instance
    // and still warn.
    createValidator(tupleSchema, { draft: '2020-12' })
    const warnings = captureWarnings(() => {
      createValidator(tupleSchema, { draft: '2020-12', strict: false })
    })
    expect(warnings.some((w) => w.toLowerCase().includes('strict'))).toBe(false)
  })

  test('validates correctly with strict disabled', () => {
    const validate = createValidator(tupleSchema, { draft: '2020-12', strict: false })
    expect(validate(['a', 1])).toEqual({ value: ['a', 1] })
    expect(validate([1, 'a']) instanceof ValidationError).toBe(true)
  })
})

describe('createStandardValidator()', () => {
  test('creates standard validator from schema', () => {
    const standard = createStandardValidator({
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    } as const)

    expect(standard['~standard'].version).toBe(1)
    expect(standard['~standard'].vendor).toBe('enkaku')

    const result = standard['~standard'].validate({ id: 'abc' })
    expect(result).toEqual({ value: { id: 'abc' } })
  })
})

describe('ValidationError getters', () => {
  const schema = {
    $id: 'getter-test',
    type: 'object',
    properties: { count: { type: 'number' } },
    required: ['count'],
    additionalProperties: false,
  } as const
  const validator = createValidator(schema)

  test('issues returns array of ValidationErrorObject', () => {
    const result = validator({ count: 'not a number' })
    expect(result).toBeInstanceOf(ValidationError)
    const error = result as ValidationError
    expect(error.issues.length).toBeGreaterThan(0)
    expect(error.issues[0]).toBeInstanceOf(ValidationErrorObject)
  })

  test('schema returns the original schema', () => {
    const result = validator({ count: 'bad' })
    const error = result as ValidationError
    expect(error.schema).toBe(schema)
  })

  test('value returns the original input', () => {
    const input = { count: 'bad' }
    const result = validator(input)
    const error = result as ValidationError
    expect(error.value).toBe(input)
  })
})

describe('ValidationErrorObject getters', () => {
  test('details returns the original AJV ErrorObject', () => {
    const errObj = new ValidationErrorObject({
      keyword: 'type',
      instancePath: '/foo/bar',
      schemaPath: '#/properties/foo/bar/type',
      params: { type: 'string' },
      message: 'must be string',
    } as never)
    expect(errObj.details.keyword).toBe('type')
    expect(errObj.details.params).toEqual({ type: 'string' })
  })

  test('path returns parsed instance path segments', () => {
    const errObj = new ValidationErrorObject({
      keyword: 'required',
      instancePath: '/deeply/nested/path',
      schemaPath: '#/required',
      params: { missingProperty: 'x' },
      message: 'required',
    } as never)
    expect(errObj.path).toEqual(['deeply', 'nested', 'path'])
  })

  test('path returns empty array for root-level error', () => {
    const errObj = new ValidationErrorObject({
      keyword: 'type',
      instancePath: '',
      schemaPath: '#/type',
      params: { type: 'object' },
      message: 'must be object',
    } as never)
    expect(errObj.path).toEqual([])
  })
})

describe('ValidationError message', () => {
  test('includes the first issue locator in the message', () => {
    const validate = createValidator({
      $id: 'test-schema',
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    } as const)
    let error: unknown
    try {
      assertType(validate, {})
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(ValidationError)
    if (!(error instanceof ValidationError)) throw error
    const message = error.message
    expect(message).toContain('test-schema')
    // root-path normalization: instancePath '' is surfaced as '/' in the message
    expect(message).toMatch(/\(\/ required\)/)
    // .issues must be preserved per spec
    expect(error.issues).toHaveLength(1)
  })
})

describe('JSON Schema 2020-12 support', () => {
  test('validates a 2020-12 prefixItems tuple with { draft: "2020-12" }', () => {
    const validator = createValidator(
      {
        $id: 'tuple2020',
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        items: false,
      } as const,
      { draft: '2020-12' },
    )
    expect(isType(validator, [1, 'a'])).toBe(true)
    expect(isType(validator, ['a', 1])).toBe(false)
    expect(isType(validator, [1, 'a', 'extra'])).toBe(false)
  })

  test('applies ajv-formats under the 2020-12 draft', () => {
    const validator = createValidator(
      { $id: 'email2020', type: 'string', format: 'email' } as const,
      { draft: '2020-12' },
    )
    expect(isType(validator, 'user@example.com')).toBe(true)
    expect(isType(validator, 'not-an-email')).toBe(false)
  })

  test('createValidator with the default draft throws on unknown 2020-12 keywords', () => {
    expect(() =>
      createValidator({
        $id: 'tuple07',
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        items: false,
      } as const),
    ).toThrow(/unknown keyword/)
  })

  test('reuses the cached 2020-12 instance across validators', () => {
    const first = createValidator(
      {
        $id: 'cacheFirst2020',
        type: 'array',
        prefixItems: [{ type: 'number' }],
        items: false,
      } as const,
      { draft: '2020-12' },
    )
    const second = createValidator(
      {
        $id: 'cacheSecond2020',
        type: 'array',
        prefixItems: [{ type: 'string' }],
        items: false,
      } as const,
      { draft: '2020-12' },
    )
    expect(isType(first, [1])).toBe(true)
    expect(isType(first, ['a'])).toBe(false)
    expect(isType(second, ['a'])).toBe(true)
    expect(isType(second, [1])).toBe(false)
  })

  test('createStandardValidator forwards the draft option', () => {
    const standard = createStandardValidator(
      {
        $id: 'tupleStandard2020',
        type: 'array',
        prefixItems: [{ type: 'number' }],
        items: false,
      } as const,
      { draft: '2020-12' },
    )
    const ok = standard['~standard'].validate([1])
    const bad = standard['~standard'].validate(['x'])
    expect(ok).toEqual({ value: [1] })
    expect(bad).toBeInstanceOf(ValidationError)
  })
})
