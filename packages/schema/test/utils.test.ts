import { describe, expect, test } from 'vitest'
import type { Schema } from '../src/types.js'
import { resolveReference, resolveSchema } from '../src/utils.js'

describe('resolveReference()', () => {
  const root: Schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    $defs: {
      Address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
        },
      },
    },
  }

  test('resolves a valid $ref path', () => {
    const result = resolveReference(root, '#/$defs/Address')
    expect(result).toEqual({
      type: 'object',
      properties: {
        street: { type: 'string' },
      },
    })
  })

  test('throws for ref not starting with #', () => {
    expect(() => resolveReference(root, 'other/path')).toThrow('Invalid reference format')
  })

  test('throws for ref pointing to non-existent path', () => {
    expect(() => resolveReference(root, '#/$defs/Missing')).toThrow('Reference not found')
  })

  test('throws for ref traversing through non-object', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100 },
      },
    }
    expect(() => resolveReference(schema, '#/properties/name/maxLength/deep')).toThrow(
      'Invalid reference path',
    )
  })

  test('rejects __proto__ segment (prototype pollution)', () => {
    expect(() => resolveReference(root, '#/__proto__/polluted')).toThrow(
      'Invalid reference segment',
    )
  })

  test('rejects constructor segment (prototype pollution)', () => {
    expect(() => resolveReference(root, '#/constructor/prototype')).toThrow(
      'Invalid reference segment',
    )
  })

  test('rejects prototype segment (prototype pollution)', () => {
    expect(() => resolveReference(root, '#/prototype/something')).toThrow(
      'Invalid reference segment',
    )
  })

  test('rejects toString segment (inherited method access)', () => {
    expect(() => resolveReference(root, '#/toString/something')).toThrow(
      'Invalid reference segment',
    )
  })

  test('rejects valueOf segment (inherited method access)', () => {
    expect(() => resolveReference(root, '#/valueOf/something')).toThrow('Invalid reference segment')
  })
})

describe('resolveSchema()', () => {
  test('returns schema as-is when no $ref', () => {
    const schema: Schema = { type: 'string' }
    expect(resolveSchema({}, schema)).toBe(schema)
  })

  test('resolves schema with $ref', () => {
    const root: Schema = {
      $defs: {
        Name: { type: 'string', maxLength: 100 },
      },
    }
    const schema: Schema = { $ref: '#/$defs/Name' }
    expect(resolveSchema(root, schema)).toEqual({ type: 'string', maxLength: 100 })
  })
})
