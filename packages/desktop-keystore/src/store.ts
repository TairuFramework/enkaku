import { fromB64 } from '@enkaku/codec'
import type { KeyStore } from '@enkaku/protocol'
import { type Credential, findCredentials, findCredentialsAsync } from '@napi-rs/keyring'

import { DesktopKeyEntry } from './entry.js'

export class DesktopKeyStore implements KeyStore<Uint8Array, DesktopKeyEntry> {
  static #byService: Record<string, DesktopKeyStore> = {}

  static open(service: string): DesktopKeyStore {
    if (DesktopKeyStore.#byService[service] == null) {
      DesktopKeyStore.#byService[service] = new DesktopKeyStore(service)
    }
    return DesktopKeyStore.#byService[service]
  }

  #entries: Record<string, DesktopKeyEntry> = {}
  #service: string

  constructor(service: string) {
    this.#service = service
  }

  #toEntry(credential: Credential): DesktopKeyEntry {
    this.#entries[credential.account] ??= new DesktopKeyEntry(
      this.#service,
      credential.account,
      fromB64(credential.password),
    )
    return this.#entries[credential.account]
  }

  list(): Array<DesktopKeyEntry> {
    const credentials = findCredentials(this.#service)
    return credentials.map((credential) => this.#toEntry(credential))
  }

  async listAsync(): Promise<Array<DesktopKeyEntry>> {
    const credentials = await findCredentialsAsync(this.#service)
    return credentials.map((credential) => this.#toEntry(credential))
  }

  entry(keyID: string): DesktopKeyEntry {
    this.#entries[keyID] ??= new DesktopKeyEntry(this.#service, keyID)
    return this.#entries[keyID]
  }
}
