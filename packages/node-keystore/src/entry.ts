import { fromB64, toB64 } from '@enkaku/codec'
import type { KeyEntry } from '@enkaku/protocol'
import { randomPrivateKey } from '@enkaku/token'
import { AsyncEntry, Entry } from '@napi-rs/keyring'

export class NodeKeyEntry implements KeyEntry<Uint8Array> {
  #async?: AsyncEntry
  #keyID: string
  #key?: Uint8Array
  #service: string
  #sync?: Entry

  constructor(service: string, keyID: string, key?: Uint8Array) {
    this.#service = service
    this.#keyID = keyID
    this.#key = key
  }

  get keyID(): string {
    return this.#keyID
  }

  get #asyncEntry(): AsyncEntry {
    this.#async ??= new AsyncEntry(this.#service, this.#keyID)
    return this.#async
  }

  get #syncEntry(): Entry {
    this.#sync ??= new Entry(this.#service, this.#keyID)
    return this.#sync
  }

  get(): Uint8Array | null {
    if (this.#key != null) {
      return this.#key
    }
    const encoded = this.#syncEntry.getPassword()
    if (encoded == null) {
      return null
    }
    this.#key = fromB64(encoded)
    return this.#key
  }

  async getAsync(): Promise<Uint8Array | null> {
    if (this.#key != null) {
      return this.#key
    }
    const encoded = await this.#asyncEntry.getPassword()
    if (encoded == null) {
      return null
    }
    this.#key = fromB64(encoded)
    return this.#key
  }

  set(key: Uint8Array): void {
    this.#syncEntry.setPassword(toB64(key))
    this.#key = key
  }

  async setAsync(key: Uint8Array): Promise<void> {
    await this.#asyncEntry.setPassword(toB64(key))
    this.#key = key
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

    const privateKey = randomPrivateKey()
    await this.setAsync(privateKey)
    return privateKey
  }

  remove(): void {
    // @ts-ignore - deletePassword is not typed in CI somehow
    this.#syncEntry.deletePassword()
    this.#key = undefined
  }

  async removeAsync(): Promise<void> {
    // @ts-ignore - deletePassword is not typed in CI somehow
    await this.#asyncEntry.deletePassword()
    this.#key = undefined
  }
}
