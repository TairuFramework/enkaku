import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock expo-secure-store
let secureStore: Record<string, string>

vi.mock('expo-secure-store', () => ({
  getItem: vi.fn((key: string) => secureStore[key] ?? null),
  getItemAsync: vi.fn(async (key: string) => secureStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    secureStore[key] = value
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore[key] = value
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete secureStore[key]
  }),
}))

// Mock expo-crypto
vi.mock('expo-crypto', () => ({
  getRandomBytes: vi.fn((size: number) => crypto.getRandomValues(new Uint8Array(size))),
  getRandomBytesAsync: vi.fn(async (size: number) => crypto.getRandomValues(new Uint8Array(size))),
}))

import {
  ExpoKeyEntry,
  ExpoKeyStore,
  provideFullIdentity,
  provideFullIdentityAsync,
  randomPrivateKey,
  randomPrivateKeyAsync,
} from '../src/index.js'

beforeEach(() => {
  secureStore = {}
})

describe('randomPrivateKey()', () => {
  test('returns 32-byte Uint8Array', () => {
    const key = randomPrivateKey()
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('async variant returns 32-byte Uint8Array', async () => {
    const key = await randomPrivateKeyAsync()
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })
})

describe('ExpoKeyEntry', () => {
  test('keyID returns the key ID', () => {
    const entry = new ExpoKeyEntry('k1')
    expect(entry.keyID).toBe('k1')
  })

  test('get() returns null when key does not exist', () => {
    expect(new ExpoKeyEntry('missing').get()).toBeNull()
  })

  test('set() stores key and get() retrieves it', () => {
    const entry = new ExpoKeyEntry('k2')
    const key = new Uint8Array([1, 2, 3])
    entry.set(key)
    expect(entry.get()).toEqual(key)
  })

  test('provide() returns existing key', () => {
    const entry = new ExpoKeyEntry('k3')
    const key = new Uint8Array([4, 5])
    entry.set(key)
    expect(entry.provide()).toEqual(key)
  })

  test('provide() generates and stores new key when none exists', () => {
    const entry = new ExpoKeyEntry('k4')
    const provided = entry.provide()
    expect(provided).toBeInstanceOf(Uint8Array)
    expect(provided.length).toBe(32)
    expect(entry.get()).toEqual(provided)
  })

  // Async variants
  test('getAsync() returns null when key does not exist', async () => {
    expect(await new ExpoKeyEntry('ak1').getAsync()).toBeNull()
  })

  test('setAsync() stores key and getAsync() retrieves it', async () => {
    const entry = new ExpoKeyEntry('ak2')
    const key = new Uint8Array([11, 22])
    await entry.setAsync(key)
    expect(await entry.getAsync()).toEqual(key)
  })

  test('provideAsync() generates key when none exists', async () => {
    const entry = new ExpoKeyEntry('ak3')
    const provided = await entry.provideAsync()
    expect(provided).toBeInstanceOf(Uint8Array)
    expect(provided.length).toBe(32)
  })

  test('removeAsync() deletes key', async () => {
    const entry = new ExpoKeyEntry('ak4')
    await entry.setAsync(new Uint8Array([33]))
    await entry.removeAsync()
    expect(await new ExpoKeyEntry('ak4').getAsync()).toBeNull()
  })
})

describe('ExpoKeyStore', () => {
  test('entry() creates ExpoKeyEntry with given keyID', () => {
    const entry = ExpoKeyStore.entry('my-key')
    expect(entry).toBeInstanceOf(ExpoKeyEntry)
    expect(entry.keyID).toBe('my-key')
  })

  test('entry() creates new instance each call (no caching)', () => {
    const a = ExpoKeyStore.entry('same')
    const b = ExpoKeyStore.entry('same')
    expect(a).not.toBe(b)
  })
})

describe('provideFullIdentity()', () => {
  test('creates identity with valid DID', () => {
    const identity = provideFullIdentity('k1')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(identity.signToken).toBeInstanceOf(Function)
  })

  test('async variant works', async () => {
    const identity = await provideFullIdentityAsync('k1')
    expect(identity.id).toMatch(/^did:key:z/)
  })
})
