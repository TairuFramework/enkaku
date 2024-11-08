import type { SignedToken, TokenSigner } from '@enkaku/token'

import { BrowserKeyStore } from './store.js'
import { getSigner } from './utils.js'

export type SignerOptions = {
  keyID?: string
  store?: BrowserKeyStore | Promise<BrowserKeyStore> | string
}

export class BrowserSigner implements TokenSigner {
  #keyID: string | undefined
  #signerPromise: Promise<TokenSigner> | undefined
  #storePromise: Promise<BrowserKeyStore>

  constructor(options: SignerOptions = {}) {
    this.#keyID = options.keyID
    this.#storePromise =
      options.store == null || typeof options.store === 'string'
        ? BrowserKeyStore.open(options.store)
        : Promise.resolve(options.store)
  }

  #getSigner(): Promise<TokenSigner> {
    if (this.#signerPromise == null) {
      this.#signerPromise = this.#storePromise
        .then((store) => store.get(this.#keyID))
        .then(getSigner)
    }
    return this.#signerPromise
  }

  async getIssuer(): Promise<string> {
    const signer = await this.#getSigner()
    return await signer.getIssuer()
  }

  async createToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    const signer = await this.#getSigner()
    return await signer.createToken(payload, header)
  }
}
