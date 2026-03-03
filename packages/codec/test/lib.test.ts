import { equals } from 'uint8arrays'
import { describe, expect, test } from 'vitest'

import {
  b64uFromJSON,
  b64uFromUTF,
  b64uToJSON,
  b64uToUTF,
  canonicalStringify,
  fromB64,
  fromB64U,
  fromUTF,
  toB64,
  toB64U,
  toUTF,
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

describe('fromB64U()', () => {
  test('rejects input containing whitespace', () => {
    expect(() => fromB64U('aGVs bG8')).toThrow('Invalid base64url')
  })

  test('rejects input containing padding characters', () => {
    expect(() => fromB64U('aGVsbG8=')).toThrow('Invalid base64url')
  })

  test('rejects input containing standard base64 characters', () => {
    expect(() => fromB64U('aGVs+G8')).toThrow('Invalid base64url')
    expect(() => fromB64U('aGVs/G8')).toThrow('Invalid base64url')
  })

  test('rejects input containing invalid characters', () => {
    expect(() => fromB64U('aGVs!G8')).toThrow('Invalid base64url')
    expect(() => fromB64U('aGVs@bG8#')).toThrow('Invalid base64url')
  })

  test('accepts valid base64url input', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111])
    const encoded = toB64U(bytes)
    expect(() => fromB64U(encoded)).not.toThrow()
  })

  test('accepts empty string', () => {
    expect(() => fromB64U('')).not.toThrow()
  })
})

describe('b64uToJSON()', () => {
  test('rejects deeply nested JSON exceeding depth limit', () => {
    const depth = 200
    const nested = `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`
    const encoded = b64uFromUTF(nested)
    expect(() => b64uToJSON(encoded)).toThrow('exceeds maximum nesting depth')
  })

  test('rejects JSON at exactly depth 129', () => {
    const depth = 129
    const nested = `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`
    const encoded = b64uFromUTF(nested)
    expect(() => b64uToJSON(encoded)).toThrow('exceeds maximum nesting depth')
  })

  test('accepts JSON at exactly depth 128', () => {
    const depth = 128
    const nested = `${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`
    const encoded = b64uFromUTF(nested)
    expect(b64uToJSON(encoded)).toBeDefined()
  })

  test('accepts JSON within depth limit', () => {
    const obj = { a: { b: { c: { d: 'value' } } } }
    const encoded = b64uFromJSON(obj)
    expect(b64uToJSON(encoded)).toEqual(obj)
  })
})

describe('canonicalStringify()', () => {
  test('produces deterministic key ordering', () => {
    const a = canonicalStringify({ z: 1, a: 2 })
    const b = canonicalStringify({ a: 2, z: 1 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":2,"z":1}')
  })

  test('handles nested objects with deterministic ordering', () => {
    const result = canonicalStringify({ b: { d: 1, c: 2 }, a: 3 })
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}')
  })

  test('handles arrays (preserves order)', () => {
    const result = canonicalStringify({ items: [3, 1, 2] })
    expect(result).toBe('{"items":[3,1,2]}')
  })

  test('handles primitive values', () => {
    expect(canonicalStringify('hello')).toBe('"hello"')
    expect(canonicalStringify(42)).toBe('42')
    expect(canonicalStringify(true)).toBe('true')
    expect(canonicalStringify(null)).toBe('null')
  })
})

describe('fromUTF() / toUTF()', () => {
  test('round-trips ASCII text', () => {
    const text = 'hello world'
    expect(toUTF(fromUTF(text))).toBe(text)
  })

  test('round-trips Unicode text', () => {
    const text = 'caf\u00e9 \u00fc\u00f1\u00efc\u00f6d\u00e9'
    expect(toUTF(fromUTF(text))).toBe(text)
  })

  test('round-trips multibyte characters', () => {
    const text = '\u4f60\u597d\u4e16\u754c'
    expect(toUTF(fromUTF(text))).toBe(text)
  })

  test('handles empty string', () => {
    const bytes = fromUTF('')
    expect(bytes.length).toBe(0)
    expect(toUTF(bytes)).toBe('')
  })

  test('fromUTF returns Uint8Array', () => {
    expect(fromUTF('test')).toBeInstanceOf(Uint8Array)
  })

  test('toUTF returns string', () => {
    expect(typeof toUTF(new Uint8Array([116, 101, 115, 116]))).toBe('string')
    expect(toUTF(new Uint8Array([116, 101, 115, 116]))).toBe('test')
  })
})

describe('b64uFromJSON() canonicalize parameter', () => {
  test('canonicalize=true (default) produces deterministic output', () => {
    const a = b64uFromJSON({ z: 1, a: 2 })
    const b = b64uFromJSON({ a: 2, z: 1 })
    expect(a).toBe(b)
  })

  test('canonicalize=false uses standard JSON.stringify', () => {
    const result = b64uFromJSON({ z: 1, a: 2 }, false)
    const decoded = b64uToUTF(result)
    // JSON.stringify preserves insertion order
    expect(decoded).toBe('{"z":1,"a":2}')
  })

  test('canonicalize=true reorders keys', () => {
    const result = b64uFromJSON({ z: 1, a: 2 }, true)
    const decoded = b64uToUTF(result)
    expect(decoded).toBe('{"a":2,"z":1}')
  })
})
