import { beforeEach, describe, expect, test, vi } from 'vitest'

// In-memory store simulating system keyring
let mockKeyring: Record<string, string>

vi.mock('@napi-rs/keyring', () => {
  class MockEntry {
    account: string
    constructor(_service: string, account: string) {
      this.account = account
    }
    getPassword() {
      return mockKeyring[this.account] ?? null
    }
    setPassword(password: string) {
      mockKeyring[this.account] = password
    }
    deletePassword() {
      delete mockKeyring[this.account]
    }
  }

  class MockAsyncEntry {
    account: string
    constructor(_service: string, account: string) {
      this.account = account
    }
    async getPassword() {
      return mockKeyring[this.account] ?? null
    }
    async setPassword(password: string) {
      mockKeyring[this.account] = password
    }
    async deletePassword() {
      delete mockKeyring[this.account]
    }
  }

  return {
    Entry: MockEntry,
    AsyncEntry: MockAsyncEntry,
    findCredentials: vi.fn((_service?: string) =>
      Object.entries(mockKeyring).map(([account, password]) => ({ account, password })),
    ),
    findCredentialsAsync: vi.fn(async (_service?: string) =>
      Object.entries(mockKeyring).map(([account, password]) => ({ account, password })),
    ),
  }
})

import {
  NodeKeyEntry,
  NodeKeyStore,
  provideFullIdentity,
  provideFullIdentityAsync,
} from '../src/index.js'

beforeEach(() => {
  mockKeyring = {}
})

describe('NodeKeyEntry', () => {
  test('keyID returns the key ID', () => {
    const entry = new NodeKeyEntry('svc', 'k1')
    expect(entry.keyID).toBe('k1')
  })

  test('get() returns null when key does not exist', () => {
    const entry = new NodeKeyEntry('svc', 'missing')
    expect(entry.get()).toBeNull()
  })

  test('set() stores key and get() retrieves it', () => {
    const entry = new NodeKeyEntry('svc', 'k1')
    const key = new Uint8Array([1, 2, 3])
    entry.set(key)
    const result = entry.get()
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result).toEqual(key)
  })

  test('get() returns cached key on subsequent calls', () => {
    const entry = new NodeKeyEntry('svc', 'k2')
    entry.set(new Uint8Array([10, 20]))
    const first = entry.get()
    const second = entry.get()
    expect(first).toBe(second) // same reference
  })

  test('provide() returns existing key', () => {
    const entry = new NodeKeyEntry('svc', 'k3')
    const key = new Uint8Array([5, 6])
    entry.set(key)
    expect(entry.provide()).toEqual(key)
  })

  test('provide() generates and stores new key when none exists', () => {
    const entry = new NodeKeyEntry('svc', 'k4')
    const provided = entry.provide()
    expect(provided).toBeInstanceOf(Uint8Array)
    expect(provided.length).toBeGreaterThan(0)
    // Stored in keyring
    expect(entry.get()).toEqual(provided)
  })

  test('remove() clears key from keyring', () => {
    const entry = new NodeKeyEntry('svc', 'k5')
    entry.set(new Uint8Array([7, 8]))
    entry.remove()
    // Fresh entry (no cache) should return null
    const fresh = new NodeKeyEntry('svc', 'k5')
    expect(fresh.get()).toBeNull()
  })

  test('constructor accepts pre-loaded key', () => {
    const key = new Uint8Array([99])
    const entry = new NodeKeyEntry('svc', 'k6', key)
    expect(entry.get()).toBe(key)
  })

  // Async variants
  test('getAsync() returns null when key does not exist', async () => {
    const entry = new NodeKeyEntry('svc', 'ak1')
    expect(await entry.getAsync()).toBeNull()
  })

  test('setAsync() stores key and getAsync() retrieves it', async () => {
    const entry = new NodeKeyEntry('svc', 'ak2')
    const key = new Uint8Array([11, 22])
    await entry.setAsync(key)
    expect(await entry.getAsync()).toEqual(key)
  })

  test('provideAsync() generates key when none exists', async () => {
    const entry = new NodeKeyEntry('svc', 'ak3')
    const provided = await entry.provideAsync()
    expect(provided).toBeInstanceOf(Uint8Array)
    expect(provided.length).toBeGreaterThan(0)
  })

  test('removeAsync() clears key', async () => {
    const entry = new NodeKeyEntry('svc', 'ak4')
    await entry.setAsync(new Uint8Array([33]))
    await entry.removeAsync()
    const fresh = new NodeKeyEntry('svc', 'ak4')
    expect(await fresh.getAsync()).toBeNull()
  })
})

describe('NodeKeyStore', () => {
  test('open() returns singleton for same service', () => {
    const a = NodeKeyStore.open('singleton-1')
    const b = NodeKeyStore.open('singleton-1')
    expect(a).toBe(b)
  })

  test('open() returns different instances for different services', () => {
    const a = NodeKeyStore.open('svc-a')
    const b = NodeKeyStore.open('svc-b')
    expect(a).not.toBe(b)
  })

  test('entry() returns NodeKeyEntry with correct keyID', () => {
    const store = NodeKeyStore.open('entry-test')
    const entry = store.entry('my-key')
    expect(entry).toBeInstanceOf(NodeKeyEntry)
    expect(entry.keyID).toBe('my-key')
  })

  test('entry() returns cached entry for same keyID', () => {
    const store = NodeKeyStore.open('cache-test')
    expect(store.entry('x')).toBe(store.entry('x'))
  })

  test('list() returns entries from keyring', () => {
    const store = new NodeKeyStore('list-test')
    store.entry('la').set(new Uint8Array([1]))
    const entries = store.list()
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries.some((e) => e.keyID === 'la')).toBe(true)
  })

  test('list() returns empty array when no credentials', () => {
    const store = new NodeKeyStore('empty-list')
    expect(store.list()).toHaveLength(0)
  })

  test('listAsync() returns entries', async () => {
    const store = new NodeKeyStore('list-async')
    store.entry('lx').set(new Uint8Array([2]))
    const entries = await store.listAsync()
    expect(entries.length).toBeGreaterThanOrEqual(1)
  })
})

describe('provideFullIdentity()', () => {
  test('creates identity from store instance', () => {
    const store = NodeKeyStore.open('id-test-1')
    const identity = provideFullIdentity(store, 'k1')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(identity.signToken).toBeInstanceOf(Function)
  })

  test('creates identity from service name string', () => {
    const identity = provideFullIdentity('id-test-2', 'k1')
    expect(identity.id).toMatch(/^did:key:z/)
  })

  test('async variant works', async () => {
    const identity = await provideFullIdentityAsync('id-test-3', 'k1')
    expect(identity.id).toMatch(/^did:key:z/)
  })

  test('same key produces same identity', () => {
    const store = NodeKeyStore.open('id-test-4')
    const a = provideFullIdentity(store, 'same')
    const b = provideFullIdentity(store, 'same')
    expect(a.id).toBe(b.id)
  })
})
