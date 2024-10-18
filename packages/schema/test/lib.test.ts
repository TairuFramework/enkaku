import { type TransformStepFailure, createTransformSource } from '@enkaku/stream'

import { ValidationError, createSchemaType, createValidationStream } from '../src/index.js'

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
    expect(valid.value).toEqual({ ok: true, value: { test: true } })
    const invalid = await reader.read()
    expect(invalid.value?.ok).toBe(false)
    expect((invalid.value as TransformStepFailure).reason).toBeInstanceOf(ValidationError)
  })
})
