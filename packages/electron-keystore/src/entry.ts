import { fromB64, toB64 } from '@enkaku/codec'
import type { KeyEntry } from '@enkaku/protocol'
import { randomPrivateKey } from '@enkaku/token'
import { safeStorage } from 'electron'

import type { KeyStorage } from './types.js'

function encryptKey(encoded: string): string {
  return toB64(safeStorage.encryptString(encoded))
}

function decryptKey(encrypted: string): string {
  return safeStorage.decryptString(Buffer.from(fromB64(encrypted)))
}

// Stored as base64
export class ElectronKeyEntry implements KeyEntry<string> {
  #keyID: string
  #key?: string
  #storage: KeyStorage

  constructor(storage: KeyStorage, keyID: string, key?: string) {
    this.#keyID = keyID
    this.#key = key
    this.#storage = storage
  }

  get keyID(): string {
    return this.#keyID
  }

  getAsync(): Promise<string | null> {
    return Promise.resolve(this.get())
  }

  get(): string | null {
    if (this.#key != null) {
      return this.#key
    }
    const encrypted = this.#storage.getKeys()[this.#keyID]
    if (encrypted == null) {
      return null
    }
    const key = decryptKey(encrypted)
    if (key == null) {
      return null
    }
    this.#key = key
    return this.#key
  }

  setAsync(key: string): Promise<void> {
    return Promise.resolve(this.set(key))
  }

  set(key: string): void {
    const encrypted = encryptKey(key)
    this.#storage.setKeys({ [this.#keyID]: encrypted })
    this.#key = key
  }

  provideAsync(): Promise<string> {
    return Promise.resolve(this.provide())
  }

  provide(): string {
    const existing = this.get()
    if (existing != null) {
      return existing
    }

    const privateKey = toB64(randomPrivateKey())
    this.set(privateKey)
    return privateKey
  }

  removeAsync(): Promise<void> {
    return Promise.resolve(this.remove())
  }

  remove(): void {
    const { [this.#keyID]: _, ...keys } = this.#storage.getKeys()
    this.#storage.setKeys(keys)
    this.#key = undefined
  }
}
