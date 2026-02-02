import { describe, expect, test } from 'vitest'

import { concatKDF } from '../src/jwe.js'

describe('concatKDF', () => {
  test('derives 256-bit key from shared secret', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const key = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('different algorithmID produces different key', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const key1 = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    const key2 = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256KW',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false)
  })

  test('different partyInfo produces different key', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const params = {
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
    }
    const key1 = concatKDF({ ...params, partyUInfo: new Uint8Array([1]), partyVInfo: new Uint8Array(0) })
    const key2 = concatKDF({ ...params, partyUInfo: new Uint8Array([2]), partyVInfo: new Uint8Array(0) })
    expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false)
  })
})
