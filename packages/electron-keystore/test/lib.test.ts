import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock electron safeStorage — identity transform for testing
vi.mock('electron', () => ({
  safeStorage: {
    encryptString: vi.fn((str: string) => Buffer.from(str)),
    decryptString: vi.fn((buf: Buffer) => buf.toString()),
  },
}))

// Mock electron-store — in-memory storage
let storeData: Record<string, Record<string, string>>

vi.mock('electron-store', () => {
  class MockStore {
    name: string
    constructor(options: { name: string }) {
      this.name = options.name
    }
    get(key: string, defaultValue: Record<string, string> = {}) {
      return storeData[this.name]?.[key] != null
        ? JSON.parse(storeData[this.name][key])
        : defaultValue
    }
    set(key: string, value: unknown) {
      storeData[this.name] ??= {}
      storeData[this.name][key] = JSON.stringify(value)
    }
  }
  return { default: MockStore }
})

import {
  type ElectronKeyEntry,
  ElectronKeyStore,
  provideFullIdentity,
  provideFullIdentityAsync,
} from '../src/index.js'

beforeEach(() => {
  storeData = {}
})

describe('ElectronKeyEntry', () => {
  function createEntry(keyID: string): ElectronKeyEntry {
    return new ElectronKeyStore(`test-${keyID}`).entry(keyID)
  }

  test('keyID returns the key ID', () => {
    expect(createEntry('k1').keyID).toBe('k1')
  })

  test('get() returns null when key does not exist', () => {
    expect(createEntry('missing').get()).toBeNull()
  })

  test('set() stores key and get() retrieves it', () => {
    const entry = createEntry('k2')
    entry.set('my-private-key')
    expect(entry.get()).toBe('my-private-key')
  })

  test('get() caches decrypted key', () => {
    const entry = createEntry('k3')
    entry.set('cached-key')
    const first = entry.get()
    const second = entry.get()
    expect(first).toBe(second)
  })

  test('provide() returns existing key', () => {
    const entry = createEntry('k4')
    entry.set('existing')
    expect(entry.provide()).toBe('existing')
  })

  test('provide() generates and stores new key when none exists', () => {
    const entry = createEntry('k5')
    const provided = entry.provide()
    expect(typeof provided).toBe('string')
    expect(provided.length).toBeGreaterThan(0)
    expect(entry.get()).toBe(provided)
  })

  test('remove() clears key from storage', () => {
    const entry = createEntry('k6')
    entry.set('to-remove')
    entry.remove()
    const fresh = new ElectronKeyStore('test-k6').entry('k6')
    expect(fresh.get()).toBeNull()
  })

  // Async variants (wrappers around sync)
  test('getAsync() returns null when key does not exist', async () => {
    expect(await createEntry('ak1').getAsync()).toBeNull()
  })

  test('setAsync() stores key', async () => {
    const entry = createEntry('ak2')
    await entry.setAsync('async-key')
    expect(await entry.getAsync()).toBe('async-key')
  })

  test('provideAsync() generates key when none exists', async () => {
    const provided = await createEntry('ak3').provideAsync()
    expect(typeof provided).toBe('string')
    expect(provided.length).toBeGreaterThan(0)
  })

  test('removeAsync() clears key', async () => {
    const entry = createEntry('ak4')
    await entry.setAsync('temp')
    await entry.removeAsync()
    const fresh = new ElectronKeyStore('test-ak4').entry('ak4')
    expect(await fresh.getAsync()).toBeNull()
  })
})

describe('ElectronKeyStore', () => {
  test('open() returns singleton for same name', () => {
    const a = ElectronKeyStore.open('singleton-a')
    const b = ElectronKeyStore.open('singleton-a')
    expect(a).toBe(b)
  })

  test('open() returns different instances for different names', () => {
    const a = ElectronKeyStore.open('store-x')
    const b = ElectronKeyStore.open('store-y')
    expect(a).not.toBe(b)
  })

  test('open() defaults to "keystore" name', () => {
    const a = ElectronKeyStore.open()
    const b = ElectronKeyStore.open('keystore')
    expect(a).toBe(b)
  })

  test('entry() returns cached entry for same keyID', () => {
    const store = ElectronKeyStore.open('cache-test')
    expect(store.entry('x')).toBe(store.entry('x'))
  })
})

describe('provideFullIdentity()', () => {
  test('creates identity from store instance', () => {
    const store = ElectronKeyStore.open('eid-1')
    const identity = provideFullIdentity(store, 'k1')
    expect(identity.id).toMatch(/^did:key:z/)
    expect(identity.signToken).toBeInstanceOf(Function)
  })

  test('creates identity from name string', () => {
    const identity = provideFullIdentity('eid-2', 'k1')
    expect(identity.id).toMatch(/^did:key:z/)
  })

  test('async variant works', async () => {
    const identity = await provideFullIdentityAsync('eid-3', 'k1')
    expect(identity.id).toMatch(/^did:key:z/)
  })
})
