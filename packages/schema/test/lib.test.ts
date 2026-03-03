import { describe, expect, test } from 'vitest'

import {
  assertType,
  createValidator,
  isType,
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
