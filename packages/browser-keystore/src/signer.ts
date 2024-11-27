import { type TokenSigner, toTokenSigner } from '@enkaku/token'

import { BrowserKeyStore } from './store.js'
import { getSigner } from './utils.js'

export async function provideTokenSigner(
  keyID: string,
  useStore?: BrowserKeyStore | Promise<BrowserKeyStore> | string,
): Promise<TokenSigner> {
  const storePromise =
    useStore == null || typeof useStore === 'string'
      ? BrowserKeyStore.open(useStore)
      : Promise.resolve(useStore)
  const store = await storePromise
  const keyPair = await store.entry(keyID).provideAsync()
  const signer = await getSigner(keyPair)
  return toTokenSigner(signer)
}
