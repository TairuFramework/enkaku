import { equals } from 'uint8arrays'

import {
  base64ToBytes,
  base64URLToBytes,
  base64URLToString,
  bytesToBase64,
  bytesToBase64URL,
  parseJSON,
  stringToBase64URL,
  stringifyJSON,
} from '../src/encoding.js'

test('bytes to base64 encoding and decoding', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const encoded = bytesToBase64(bytes)
  const decoded = base64ToBytes(encoded)
  expect(equals(decoded, bytes)).toBe(true)
})

test('bytes to base64url encoding and decoding', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const encoded = bytesToBase64URL(bytes)
  const decoded = base64URLToBytes(encoded)
  expect(equals(decoded, bytes)).toBe(true)
})

test('UTF8 string to base64url encoding and decoding', () => {
  const text = 'foo bar'
  const encoded = stringToBase64URL(text)
  const decoded = base64URLToString(encoded)
  expect(decoded).toBe(text)
})

test('JSON to base64url encoding and decoding', () => {
  const data = { foo: 'bar' }
  const encoded = stringifyJSON(data)
  const decoded = parseJSON(encoded)
  expect(decoded).toEqual(data)
})
