import { describe, expect, test } from 'vitest'

import { CODECS, getAlgorithmAndPublicKey, getDID, getSignatureInfo } from '../src/did.js'

describe('getAlgorithmAndPublicKey()', () => {
  test('returns null for bytes shorter than any codec', () => {
    const shortBytes = new Uint8Array([0xed])
    expect(getAlgorithmAndPublicKey(shortBytes)).toBeNull()
  })

  test('returns null for empty bytes', () => {
    const empty = new Uint8Array(0)
    expect(getAlgorithmAndPublicKey(empty)).toBeNull()
  })

  test('returns algorithm and public key for valid EdDSA bytes', () => {
    const publicKey = new Uint8Array([1, 2, 3, 4])
    const codec = CODECS.EdDSA
    const bytes = new Uint8Array(codec.length + publicKey.length)
    bytes.set(codec)
    bytes.set(publicKey, codec.length)
    const result = getAlgorithmAndPublicKey(bytes)
    expect(result).not.toBeNull()
    expect(result?.[0]).toBe('EdDSA')
    expect(result?.[1]).toEqual(publicKey)
  })

  test('returns algorithm and public key for valid ES256 bytes', () => {
    const publicKey = new Uint8Array([5, 6, 7, 8])
    const codec = CODECS.ES256
    const bytes = new Uint8Array(codec.length + publicKey.length)
    bytes.set(codec)
    bytes.set(publicKey, codec.length)
    const result = getAlgorithmAndPublicKey(bytes)
    expect(result).not.toBeNull()
    expect(result?.[0]).toBe('ES256')
    expect(result?.[1]).toEqual(publicKey)
  })
})

describe('getSignatureInfo()', () => {
  test('throws for invalid DID prefix', () => {
    expect(() => getSignatureInfo('invalid:key:z123')).toThrow('Invalid DID to decode')
  })

  test('throws for unsupported codec', () => {
    expect(() => getSignatureInfo('did:key:z1111')).toThrow('Unsupported DID signature codec')
  })
})

describe('getDID()', () => {
  test('creates a DID string with did:key:z prefix', () => {
    const codec = CODECS.EdDSA
    const publicKey = new Uint8Array([1, 2, 3])
    const did = getDID(codec, publicKey)
    expect(did.startsWith('did:key:z')).toBe(true)
  })

  test('round-trips through getSignatureInfo', () => {
    const codec = CODECS.EdDSA
    const publicKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const did = getDID(codec, publicKey)
    const [alg, extractedKey] = getSignatureInfo(did)
    expect(alg).toBe('EdDSA')
    expect(extractedKey).toEqual(publicKey)
  })
})
