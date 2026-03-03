import { beforeEach, describe, expect, test } from 'vitest'

import type { GetStore } from '../src/entry.js'
import { BrowserKeyEntry } from '../src/entry.js'
import { getPublicKey, randomKeyPair } from '../src/utils.js'

// --- Mock IDB helpers ---

function createMockGetStore(): { getStore: GetStore; data: Map<string, unknown> } {
  const data = new Map<string, unknown>()

  const getStore: GetStore = () =>
    ({
      get(key: string) {
        const result = data.get(key)
        const request: Record<string, unknown> = { result }
        queueMicrotask(() => (request.onsuccess as (e: Event) => void)?.({} as Event))
        return request as unknown as IDBRequest
      },
      put(value: unknown, key: string) {
        data.set(key, value)
        const request: Record<string, unknown> = {}
        queueMicrotask(() => (request.onsuccess as (e: Event) => void)?.({} as Event))
        return request as unknown as IDBRequest
      },
      delete(key: string) {
        data.delete(key)
        const request: Record<string, unknown> = {}
        queueMicrotask(() => (request.onsuccess as (e: Event) => void)?.({} as Event))
        return request as unknown as IDBRequest
      },
    }) as unknown as IDBObjectStore

  return { getStore, data }
}

// --- Utils tests (real SubtleCrypto) ---

describe('randomKeyPair()', () => {
  test('generates ECDSA P-256 key pair', async () => {
    const keyPair = await randomKeyPair()
    expect(keyPair.publicKey).toBeDefined()
    expect(keyPair.privateKey).toBeDefined()
    expect(keyPair.publicKey.algorithm).toEqual(
      expect.objectContaining({ name: 'ECDSA', namedCurve: 'P-256' }),
    )
  })

  test('private key is non-extractable', async () => {
    const keyPair = await randomKeyPair()
    expect(keyPair.privateKey.extractable).toBe(false)
  })

  test('private key allows signing', async () => {
    const keyPair = await randomKeyPair()
    expect(keyPair.privateKey.usages).toContain('sign')
  })
})

describe('getPublicKey()', () => {
  test('returns 33-byte compressed public key', async () => {
    const keyPair = await randomKeyPair()
    const publicKey = await getPublicKey(keyPair)
    expect(publicKey).toBeInstanceOf(Uint8Array)
    expect(publicKey.length).toBe(33)
  })

  test('first byte is 0x02 or 0x03 (EC point compression prefix)', async () => {
    const keyPair = await randomKeyPair()
    const publicKey = await getPublicKey(keyPair)
    expect([0x02, 0x03]).toContain(publicKey[0])
  })

  test('same key pair produces same public key', async () => {
    const keyPair = await randomKeyPair()
    const pk1 = await getPublicKey(keyPair)
    const pk2 = await getPublicKey(keyPair)
    expect(pk1).toEqual(pk2)
  })
})

// --- Entry tests (mock IDB) ---

describe('BrowserKeyEntry', () => {
  let getStore: GetStore
  let data: Map<string, unknown>

  beforeEach(() => {
    const mock = createMockGetStore()
    getStore = mock.getStore
    data = mock.data
  })

  test('keyID returns the key ID', () => {
    const entry = new BrowserKeyEntry('k1', getStore)
    expect(entry.keyID).toBe('k1')
  })

  test('getAsync() returns null when key does not exist', async () => {
    const entry = new BrowserKeyEntry('missing', getStore)
    expect(await entry.getAsync()).toBeNull()
  })

  test('setAsync() stores key and getAsync() retrieves it', async () => {
    const keyPair = await randomKeyPair()
    const entry = new BrowserKeyEntry('k2', getStore)
    await entry.setAsync(keyPair)
    const retrieved = await entry.getAsync()
    expect(retrieved).toBe(keyPair)
  })

  test('provideAsync() returns existing key without generating new one', async () => {
    const keyPair = await randomKeyPair()
    const entry = new BrowserKeyEntry('k3', getStore)
    await entry.setAsync(keyPair)
    const provided = await entry.provideAsync()
    expect(provided).toBe(keyPair)
  })

  test('provideAsync() generates and stores new key when none exists', async () => {
    const entry = new BrowserKeyEntry('k4', getStore)
    const provided = await entry.provideAsync()
    expect(provided.publicKey).toBeDefined()
    expect(provided.privateKey).toBeDefined()
    // Stored in mock IDB
    expect(data.has('k4')).toBe(true)
  })

  test('removeAsync() deletes key from store', async () => {
    const keyPair = await randomKeyPair()
    const entry = new BrowserKeyEntry('k5', getStore)
    await entry.setAsync(keyPair)
    expect(data.has('k5')).toBe(true)
    await entry.removeAsync()
    expect(data.has('k5')).toBe(false)
  })
})

// --- Store tests ---

describe('BrowserKeyStore', () => {
  test('entry() returns BrowserKeyEntry with correct keyID', async () => {
    const { BrowserKeyStore } = await import('../src/store.js')
    const mockDB = {
      transaction: () => ({
        objectStore: () => createMockGetStore().getStore(),
      }),
    } as unknown as IDBDatabase
    const store = new BrowserKeyStore(mockDB)
    const entry = store.entry('my-key')
    expect(entry).toBeInstanceOf(BrowserKeyEntry)
    expect(entry.keyID).toBe('my-key')
  })

  test('entry() returns cached entry for same keyID', async () => {
    const { BrowserKeyStore } = await import('../src/store.js')
    const mockDB = {
      transaction: () => ({
        objectStore: () => createMockGetStore().getStore(),
      }),
    } as unknown as IDBDatabase
    const store = new BrowserKeyStore(mockDB)
    expect(store.entry('x')).toBe(store.entry('x'))
  })
})
