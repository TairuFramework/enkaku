import { createTransformSource } from '@enkaku/stream'
import { Result } from 'typescript-result'

import { ValidationError, createSchemaType, createValidationStream } from '../src/index.js'

describe('createSchemaType()', () => {
  test('creates a schema type with validation functions', () => {
    const type = createSchemaType({
      $id: 'test',
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    } as const)

    expect(type.assert({ test: true })).toBeUndefined()
    expect(() => type.assert({ test: false, extra: true })).toThrow()
    expect(type.cast({ test: true })).toEqual({ test: true })
    expect(() => type.cast({ test: false, extra: true })).toThrow()
    expect(type.is({ test: true })).toBe(true)
    expect(type.is({ test: false, extra: true })).toBe(false)

    const validateSuccess = type.validate({ test: true })
    expect(validateSuccess).toBeInstanceOf(Result)
    expect(validateSuccess.isOk()).toBe(true)
    expect(validateSuccess.value).toEqual({ test: true })

    const validateFailure = type.validate({ test: false, extra: true })
    expect(validateFailure).toBeInstanceOf(Result)
    expect(validateFailure.isError()).toBe(true)
    expect(validateFailure.error).toBeInstanceOf(ValidationError)
  })
})

describe('createValidationStream()', () => {
  test('validates data against the schema', async () => {
    const type = createSchemaType({
      $id: 'test',
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    } as const)
    type T = (typeof type)['Type']

    const source = createTransformSource<T>()
    const writer = source.writable.getWriter()
    writer.write({ test: true })
    // @ts-expect-error
    writer.write({ test: false, extra: true })

    const reader = source.readable.pipeThrough(createValidationStream(type)).getReader()
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
