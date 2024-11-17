import { fromB64, toB64 } from '@enkaku/codec'
import type { KeyEntry } from '@enkaku/protocol'
import * as SecureStore from 'expo-secure-store'

import { randomPrivateKey, randomPrivateKeyAsync } from './utils.js'

export class ExpoKeyEntry implements KeyEntry<Uint8Array> {
  #keyID: string

  constructor(keyID: string) {
    this.#keyID = keyID
  }

  get keyID(): string {
    return this.#keyID
  }

  get(): Uint8Array | null {
    const privateKey = SecureStore.getItem(this.#keyID)
    return privateKey ? fromB64(privateKey) : null
  }

  async getAsync(): Promise<Uint8Array | null> {
    const privateKey = await SecureStore.getItemAsync(this.#keyID)
    return privateKey ? fromB64(privateKey) : null
  }

  set(privateKey: Uint8Array): void {
    SecureStore.setItem(this.#keyID, toB64(privateKey))
  }

  async setAsync(privateKey: Uint8Array): Promise<void> {
    await SecureStore.setItemAsync(this.#keyID, toB64(privateKey))
  }

  provide(): Uint8Array {
    const existing = this.get()
    if (existing != null) {
      return existing
    }

    const privateKey = randomPrivateKey()
    this.set(privateKey)
    return privateKey
  }

  async provideAsync(): Promise<Uint8Array> {
    const existing = await this.getAsync()
    if (existing != null) {
      return existing
    }

    const privateKey = await randomPrivateKeyAsync()
    await this.setAsync(privateKey)
    return privateKey
  }

  async removeAsync(): Promise<void> {
    await SecureStore.deleteItemAsync(this.#keyID)
  }
}
