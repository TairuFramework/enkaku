import { describe, expect, test } from 'vitest'

import {
  CLA,
  checkStatusWord,
  encodeDerivationPath,
  encodeSignMessageChunks,
  INS,
  parsePublicKeyResponse,
  parseSharedSecretResponse,
  parseSignatureResponse,
} from '../src/apdu.js'

describe('constants', () => {
  test('CLA is 0xE0', () => {
    expect(CLA).toBe(0xe0)
  })

  test('INS values', () => {
    expect(INS.GET_APP_VERSION).toBe(0x01)
    expect(INS.GET_PUBLIC_KEY).toBe(0x02)
    expect(INS.SIGN_MESSAGE).toBe(0x03)
    expect(INS.ECDH_X25519).toBe(0x04)
  })
})

describe('encodeDerivationPath()', () => {
  test('encodes hardened path components', () => {
    const encoded = encodeDerivationPath("m/44'/903'/0'")
    expect(encoded.length).toBe(1 + 3 * 4)
    expect(encoded[0]).toBe(3)
  })

  test('throws for non-hardened components', () => {
    expect(() => encodeDerivationPath('m/44/903/0')).toThrow()
  })
})

describe('encodeSignMessageChunks()', () => {
  test('returns single chunk for small message', () => {
    const path = encodeDerivationPath("m/44'/903'/0'")
    const message = new Uint8Array(32)
    const chunks = encodeSignMessageChunks(path, message)
    expect(chunks.length).toBe(1)
    expect(chunks[0].p1).toBe(0x00)
    expect(chunks[0].p2).toBe(0x00)
  })

  test('returns multiple chunks for large message', () => {
    const path = encodeDerivationPath("m/44'/903'/0'")
    const message = new Uint8Array(512)
    const chunks = encodeSignMessageChunks(path, message)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].p1).toBe(0x00)
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].p1).toBe(0x80)
    }
    // Last chunk: P2 = 0x00 (sign now)
    expect(chunks[chunks.length - 1].p2).toBe(0x00)
    // All non-last chunks: P2 = 0x80 (more chunks follow)
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].p2).toBe(0x80)
    }
  })
})

describe('response parsers', () => {
  test('parsePublicKeyResponse() extracts 32-byte key', () => {
    const response = new Uint8Array(32)
    response[0] = 0xab
    const key = parsePublicKeyResponse(response)
    expect(key.length).toBe(32)
    expect(key[0]).toBe(0xab)
  })

  test('parseSignatureResponse() extracts 64-byte signature', () => {
    const response = new Uint8Array(64)
    const sig = parseSignatureResponse(response)
    expect(sig.length).toBe(64)
  })

  test('parseSharedSecretResponse() extracts 32-byte secret', () => {
    const response = new Uint8Array(32)
    const secret = parseSharedSecretResponse(response)
    expect(secret.length).toBe(32)
  })
})

describe('checkStatusWord()', () => {
  test('does not throw for success (0x9000)', () => {
    expect(() => checkStatusWord(0x9000)).not.toThrow()
  })

  test('throws LedgerUserRejectedError for 0x6985', async () => {
    const { LedgerUserRejectedError } = await import('../src/errors.js')
    expect(() => checkStatusWord(0x6985)).toThrow(LedgerUserRejectedError)
  })

  test('throws LedgerAppNotOpenError for 0x6A82', async () => {
    const { LedgerAppNotOpenError } = await import('../src/errors.js')
    expect(() => checkStatusWord(0x6a82)).toThrow(LedgerAppNotOpenError)
  })
})
