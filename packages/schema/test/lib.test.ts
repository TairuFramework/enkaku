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
