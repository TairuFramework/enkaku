import { fromB64 } from '@enkaku/codec'
import type { KeyStore } from '@enkaku/protocol'
import { type Credential, findCredentials, findCredentialsAsync } from '@napi-rs/keyring'

import { NodeKeyEntry } from './entry.js'

export class NodeKeyStore implements KeyStore<Uint8Array, NodeKeyEntry> {
  static #byService: Record<string, NodeKeyStore> = {}

  static open(service: string): NodeKeyStore {
    if (NodeKeyStore.#byService[service] == null) {
      NodeKeyStore.#byService[service] = new NodeKeyStore(service)
    }
    return NodeKeyStore.#byService[service]
  }

  #entries: Record<string, NodeKeyEntry> = {}
  #service: string

  constructor(service: string) {
    this.#service = service
  }

  #toEntry(credential: Credential): NodeKeyEntry {
    this.#entries[credential.account] ??= new NodeKeyEntry(
      this.#service,
      credential.account,
      fromB64(credential.password),
    )
    return this.#entries[credential.account]
  }

  list(): Array<NodeKeyEntry> {
    const credentials = findCredentials(this.#service)
    return credentials.map((credential) => this.#toEntry(credential))
  }

  async listAsync(): Promise<Array<NodeKeyEntry>> {
    const credentials = await findCredentialsAsync(this.#service)
    return credentials.map((credential) => this.#toEntry(credential))
  }

  entry(keyID: string): NodeKeyEntry {
    this.#entries[keyID] ??= new NodeKeyEntry(this.#service, keyID)
    return this.#entries[keyID]
  }
}
