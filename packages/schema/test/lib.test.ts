import { createTransformSource } from '@enkaku/stream'
import { Result } from 'typescript-result'

import {
  ValidationError,
  assertType,
  createValidationStream,
  createValidator,
  isType,
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
    expect(validateSuccess).toBeInstanceOf(Result)
    expect(validateSuccess.isOk()).toBe(true)
    expect(validateSuccess.value).toEqual({ test: true })

    const validateFailure = validator({ test: false, extra: true })
    expect(validateFailure).toBeInstanceOf(Result)
    expect(validateFailure.isError()).toBe(true)
    expect(validateFailure.error).toBeInstanceOf(ValidationError)
  })
})

describe('createValidationStream()', () => {
  test('validates data against the schema', async () => {
    const validator = createValidator({
      $id: 'test',
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    } as const)

    const source = createTransformSource<T>()
    const writer = source.writable.getWriter()
    writer.write({ test: true })
    writer.write({ test: false, extra: true })

    const reader = source.readable.pipeThrough(createValidationStream(validator)).getReader()
    const valid = await reader.read()
    expect(valid.value).toBeInstanceOf(Result)
    expect(valid.value?.isOk()).toBe(true)
    expect(valid.value?.value).toEqual({ test: true })
    const invalid = await reader.read()
    expect(invalid.value).toBeInstanceOf(Result)
    expect(invalid.value?.isOk()).toBe(false)
    expect(invalid.value?.error).toBeInstanceOf(ValidationError)
  })
})
