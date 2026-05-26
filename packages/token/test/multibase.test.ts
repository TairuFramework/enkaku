import { describe, expect, it } from 'vitest'
import {
  decodeMultibase,
  encodeMultibase,
  multihashSHA256,
  verifyMultihash,
} from '../src/multibase.js'

describe('multibase', () => {
  it('round-trips bytes through base58btc multibase', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const encoded = encodeMultibase(bytes)
    expect(encoded.startsWith('z')).toBe(true)
    expect(decodeMultibase(encoded)).toEqual(bytes)
  })

  it('rejects non-z prefixes', () => {
    expect(() => decodeMultibase('mAAAA')).toThrow(/Unsupported multibase prefix/)
  })

  it('rejects empty string', () => {
    expect(() => decodeMultibase('')).toThrow(/Invalid multibase encoding/)
  })
})

describe('multihash SHA-256', () => {
  it('produces 0x12 0x20 prefix + 32-byte digest', () => {
    const mh = multihashSHA256(new Uint8Array([1, 2, 3]))
    expect(mh.length).toBe(34)
    expect(mh[0]).toBe(0x12)
    expect(mh[1]).toBe(0x20)
  })

  it('verifies a valid multihash against original bytes', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(bytes)
    expect(verifyMultihash(mh, bytes)).toBe(true)
  })

  it('rejects a multihash that does not match the bytes', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(new TextEncoder().encode('world'))
    expect(verifyMultihash(mh, bytes)).toBe(false)
  })

  it('rejects a multihash with wrong function code', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(bytes)
    mh[0] = 0x13
    expect(verifyMultihash(mh, bytes)).toBe(false)
  })

  it('rejects a multihash with wrong length byte', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(bytes)
    mh[1] = 0x10
    expect(verifyMultihash(mh, bytes)).toBe(false)
  })
})
