import { defer } from '@enkaku/async'
import type { KeyStore } from '@enkaku/protocol'

import { BrowserKeyEntry, type GetStore } from './entry.js'

const DEFAULT_DB_NAME = 'enkaku:key-store'
const STORE_NAME = 'keys'

function createGetStore(db: IDBDatabase): GetStore {
  return function getStore(mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
  }
}

export class BrowserKeyStore implements KeyStore<CryptoKeyPair, BrowserKeyEntry> {
  static #byName: Record<string, Promise<BrowserKeyStore>> = {}

  static open(name = DEFAULT_DB_NAME): Promise<BrowserKeyStore> {
    const existing = BrowserKeyStore.#byName[name]
    if (existing != null) {
      return existing
    }

    const { promise, reject, resolve } = defer<BrowserKeyStore>()
    BrowserKeyStore.#byName[name] = promise

    if (typeof globalThis.crypto.subtle === 'undefined') {
      reject(new Error('Unable to open KeyStore: SubtleCrypto is not available'))
      return promise
    }
    if (typeof globalThis.indexedDB === 'undefined') {
      reject(new Error('Unable to open KeyStore: IndexedDB is not available'))
      return promise
    }

    const request = indexedDB.open(name, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(new BrowserKeyStore(request.result))
    request.onupgradeneeded = (event) => {
      ;(event.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME)
    }
    return promise
  }

  #entries: Record<string, BrowserKeyEntry> = {}
  #getStore: GetStore

  constructor(db: IDBDatabase) {
    this.#getStore = createGetStore(db)
  }

  entry(keyID: string): BrowserKeyEntry {
    this.#entries[keyID] ??= new BrowserKeyEntry(keyID, this.#getStore)
    return this.#entries[keyID]
  }
}
