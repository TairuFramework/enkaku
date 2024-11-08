const DEFAULT_DB_NAME = 'enkaku:key-store'
const DEFAULT_ID = 'default'
const STORE_NAME = 'keys'

import { randomKeyPair } from './utils.js'

export class BrowserKeyStore {
  static open(name = DEFAULT_DB_NAME): Promise<BrowserKeyStore> {
    return new Promise((resolve, reject) => {
      if (typeof globalThis.crypto.subtle === 'undefined') {
        return reject(new Error('Unable to open KeyStore: SubtleCrypto is not available'))
      }
      if (typeof globalThis.indexedDB === 'undefined') {
        return reject(new Error('Unable to open KeyStore: IndexedDB is not available'))
      }

      const request = indexedDB.open(name, 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(new BrowserKeyStore(request.result))
      request.onupgradeneeded = (event) => {
        ;(event.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME)
      }
    })
  }

  #db: IDBDatabase

  constructor(db: IDBDatabase) {
    this.#db = db
  }

  #getStore(mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    return this.#db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
  }

  #load(id = DEFAULT_ID): Promise<CryptoKeyPair | undefined> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore().get(id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  #store(id: string, value: CryptoKeyPair): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore('readwrite').put(value, id)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async #setKeyPair(id: string): Promise<CryptoKeyPair> {
    const keyPair = await randomKeyPair()
    await this.#store(id, keyPair)
    return keyPair
  }

  async get(id = DEFAULT_ID): Promise<CryptoKeyPair> {
    const existing = await this.#load(id)
    return existing ?? (await this.#setKeyPair(id))
  }

  async reset(id = DEFAULT_ID): Promise<CryptoKeyPair> {
    return await this.#setKeyPair(id)
  }
}
