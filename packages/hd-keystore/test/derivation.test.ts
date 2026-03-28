import { describe, expect, test } from 'vitest'

import { derivePrivateKey, resolveDerivationPath } from '../src/derivation.js'

const DEFAULT_BASE_PATH = "44'/876'"

describe('resolveDerivationPath()', () => {
  test('resolves numeric index to full path', () => {
    expect(resolveDerivationPath('0', DEFAULT_BASE_PATH)).toBe("m/44'/876'/0'")
  })

  test('resolves string index to full hardened path', () => {
    expect(resolveDerivationPath('5', DEFAULT_BASE_PATH)).toBe("m/44'/876'/5'")
  })

  test('passes through full path unchanged', () => {
    expect(resolveDerivationPath("m/44'/876'/2'", DEFAULT_BASE_PATH)).toBe("m/44'/876'/2'")
  })

  test('throws for invalid keyID', () => {
    expect(() => resolveDerivationPath('abc', DEFAULT_BASE_PATH)).toThrow()
  })
})

describe('derivePrivateKey()', () => {
  // SLIP-0010 test vector from https://github.com/satoshilabs/slips/blob/master/slip-0010.md
  // Test Vector 1 for ed25519
  const SEED = Uint8Array.from(
    ('000102030405060708090a0b0c0d0e0f'.match(/.{2}/g) ?? []).map((b) => Number.parseInt(b, 16)),
  )

  test('derives master key from seed', () => {
    const key = derivePrivateKey(SEED, 'm')
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('derives child key at path', () => {
    const key = derivePrivateKey(SEED, "m/0'")
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('same seed + path produces same key', () => {
    const a = derivePrivateKey(SEED, "m/44'/876'/0'")
    const b = derivePrivateKey(SEED, "m/44'/876'/0'")
    expect(a).toEqual(b)
  })

  test('different paths produce different keys', () => {
    const a = derivePrivateKey(SEED, "m/44'/876'/0'")
    const b = derivePrivateKey(SEED, "m/44'/876'/1'")
    expect(a).not.toEqual(b)
  })
})
