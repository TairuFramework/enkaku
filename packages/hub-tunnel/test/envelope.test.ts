import { describe, expect, test } from 'vitest'

import { decodeEnvelope, encodeEnvelope, type TunnelEnvelope } from '../src/envelope.js'
import { EnvelopeDecodeError } from '../src/errors.js'

describe('TunnelEnvelope codec', () => {
  test('round-trips a valid envelope', () => {
    const envelope: TunnelEnvelope = {
      v: 1,
      groupID: 'group-1',
      ciphertext: 'aGVsbG8=',
    }
    const decoded = decodeEnvelope(encodeEnvelope(envelope))
    expect(decoded).toEqual(envelope)
  })

  test('round-trips with non-empty groupID and ciphertext', () => {
    const envelope: TunnelEnvelope = {
      v: 1,
      groupID: 'group-with-some-id',
      ciphertext: 'YmluYXJ5LWN0LWJ5dGVz',
    }
    const decoded = decodeEnvelope(encodeEnvelope(envelope))
    expect(decoded.groupID).toBe('group-with-some-id')
    expect(decoded.ciphertext).toBe('YmluYXJ5LWN0LWJ5dGVz')
  })

  test('throws EnvelopeDecodeError on malformed JSON', () => {
    const bytes = new TextEncoder().encode('{not json')
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError)
  })

  test('throws EnvelopeDecodeError when groupID is missing', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, ciphertext: 'aGk=' }))
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError)
  })

  test('throws EnvelopeDecodeError when ciphertext is missing', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, groupID: 'g' }))
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError)
  })

  test('throws EnvelopeDecodeError on wrong version', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 2, groupID: 'g', ciphertext: 'aGk=' }),
    )
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError)
  })

  test('throws EnvelopeDecodeError when ciphertext has the wrong type', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, groupID: 'g', ciphertext: 123 }))
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError)
  })

  test('throws EnvelopeDecodeError on additional properties', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ v: 1, groupID: 'g', ciphertext: 'aGk=', extra: 'nope' }),
    )
    expect(() => decodeEnvelope(bytes)).toThrow(EnvelopeDecodeError)
  })
})
