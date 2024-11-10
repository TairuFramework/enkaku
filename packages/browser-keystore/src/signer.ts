import type { TokenSigner } from '@enkaku/token'

import { BrowserKeyStore } from './store.js'
import { getSigner } from './utils.js'

export type SignerOptions = {
  keyID?: string
  store?: BrowserKeyStore | Promise<BrowserKeyStore> | string
}

export async function loadSigner(options: SignerOptions = {}): Promise<TokenSigner> {
  const storePromise =
    options.store == null || typeof options.store === 'string'
      ? await BrowserKeyStore.open(options.store)
      : Promise.resolve(options.store)
  const store = await storePromise
  const keyPair = await store.get(options.keyID)
  return await getSigner(keyPair)
}
