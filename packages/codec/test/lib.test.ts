import { equals } from 'uint8arrays'
import { describe, expect, test } from 'vitest'

import {
  b64uFromJSON,
  b64uFromUTF,
  b64uToJSON,
  b64uToUTF,
  fromB64,
  fromB64U,
  toB64,
  toB64U,
} from '../src/index.js'

test('bytes to base64 encoding and decoding', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const encoded = toB64(bytes)
  const decoded = fromB64(encoded)
  expect(equals(decoded, bytes)).toBe(true)
})

test('bytes to base64url encoding and decoding', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const encoded = toB64U(bytes)
  const decoded = fromB64U(encoded)
  expect(equals(decoded, bytes)).toBe(true)
})

test('UTF string to base64url encoding and decoding', () => {
  const text = 'foo bar'
  const encoded = b64uFromUTF(text)
  const decoded = b64uToUTF(encoded)
  expect(decoded).toBe(text)
})

test('JSON to base64url encoding and decoding', () => {
  const data = { foo: 'bar' }
  const encoded = b64uFromJSON(data)
  const decoded = b64uToJSON(encoded)
  expect(decoded).toEqual(data)
})

describe('b64uToJSON()', () => {
  test('rejects deeply nested JSON exceeding depth limit', () => {
    const depth = 200
    const nested = `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`
    const encoded = b64uFromUTF(nested)
    expect(() => b64uToJSON(encoded)).toThrow('exceeds maximum nesting depth')
  })

  test('accepts JSON within depth limit', () => {
    const obj = { a: { b: { c: { d: 'value' } } } }
    const encoded = b64uFromJSON(obj)
    expect(b64uToJSON(encoded)).toEqual(obj)
  })
})
