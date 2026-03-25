import type { KeyEntry } from '@enkaku/protocol'

import { derivePrivateKey } from './derivation.js'

export type HDKeyEntryParams = {
  seed: Uint8Array
  path: string
}

export class HDKeyEntry implements KeyEntry<Uint8Array> {
  #seed: Uint8Array
  #path: string
  #cachedKey?: Uint8Array

  constructor(params: HDKeyEntryParams) {
    this.#seed = params.seed
    this.#path = params.path
  }

  get keyID(): string {
    return this.#path
  }

  #derive(): Uint8Array {
    this.#cachedKey ??= derivePrivateKey(this.#seed, this.#path)
    return this.#cachedKey
  }

  async getAsync(): Promise<Uint8Array | null> {
    return this.#derive()
  }

  async setAsync(_privateKey: Uint8Array): Promise<void> {
    throw new Error('HD keys are derived, not stored')
  }

  async provideAsync(): Promise<Uint8Array> {
    return this.#derive()
  }

  async removeAsync(): Promise<void> {
    // no-op — derived keys cannot be removed
  }
}
