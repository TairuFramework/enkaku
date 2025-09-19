import { getTokenSigner, type TokenSigner } from '@enkaku/token'

import { ElectronKeyStore } from './store.js'

function getStore(store: ElectronKeyStore | string): ElectronKeyStore {
  return typeof store === 'string' ? ElectronKeyStore.open(store) : store
}

export function provideTokenSigner(store: ElectronKeyStore | string, keyID: string): TokenSigner {
  const key = getStore(store).entry(keyID).provide()
  return getTokenSigner(key)
}

export async function provideTokenSignerAsync(
  store: ElectronKeyStore | string,
  keyID: string,
): Promise<TokenSigner> {
  const key = await getStore(store).entry(keyID).provideAsync()
  return getTokenSigner(key)
}
