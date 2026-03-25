import { describe, expect, test } from 'vitest'
import { derivePrivateKey } from '../src/derivation.js'
import { HDKeyEntry } from '../src/entry.js'

// Deterministic seed for testing
const SEED = Uint8Array.from(
  '000102030405060708090a0b0c0d0e0f'.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)),
)

describe('HDKeyEntry', () => {
  test('keyID is accessible', () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    expect(entry.keyID).toBe("m/44'/903'/0'")
  })

  test('getAsync() returns derived private key', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    const key = await entry.getAsync()
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key!.length).toBe(32)
    // Should match direct derivation
    expect(key).toEqual(derivePrivateKey(SEED, "m/44'/903'/0'"))
  })

  test('provideAsync() returns same key as getAsync()', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    const a = await entry.getAsync()
    const b = await entry.provideAsync()
    expect(a).toEqual(b)
  })

  test('setAsync() throws', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    await expect(entry.setAsync(new Uint8Array(32))).rejects.toThrow(
      'HD keys are derived, not stored',
    )
  })

  test('removeAsync() is a no-op', async () => {
    const entry = new HDKeyEntry({ seed: SEED, path: "m/44'/903'/0'" })
    await expect(entry.removeAsync()).resolves.toBeUndefined()
  })
})
