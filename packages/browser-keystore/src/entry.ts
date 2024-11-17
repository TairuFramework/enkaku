import type { KeyEntry } from '@enkaku/protocol'

import { randomKeyPair } from './utils.js'

export type GetStore = (mode?: IDBTransactionMode) => IDBObjectStore

export class BrowserKeyEntry implements KeyEntry<CryptoKeyPair> {
  #getStore: GetStore
  #keyID: string

  constructor(keyID: string, getStore: GetStore) {
    this.#getStore = getStore
    this.#keyID = keyID
  }

  get keyID(): string {
    return this.#keyID
  }

  getAsync(): Promise<CryptoKeyPair | null> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore().get(this.#keyID)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? null)
    })
  }

  setAsync(keyPair: CryptoKeyPair): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore('readwrite').put(keyPair, this.#keyID)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async provideAsync(): Promise<CryptoKeyPair> {
    const existing = await this.getAsync()
    if (existing != null) {
      return existing
    }

    const keyPair = await randomKeyPair()
    await this.setAsync(keyPair)
    return keyPair
  }

  removeAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore('readwrite').delete(this.#keyID)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}
