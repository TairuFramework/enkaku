import { type TokenSigner, getTokenSigner } from '@enkaku/token'

import { DesktopKeyStore } from './store.js'

function getStore(store: DesktopKeyStore | string): DesktopKeyStore {
  return typeof store === 'string' ? DesktopKeyStore.open(store) : store
}

export function provideTokenSigner(store: DesktopKeyStore | string, keyID: string): TokenSigner {
  const key = getStore(store).entry(keyID).provide()
  return getTokenSigner(key)
}

export async function provideTokenSignerAsync(
  store: DesktopKeyStore | string,
  keyID: string,
): Promise<TokenSigner> {
  const key = await getStore(store).entry(keyID).provideAsync()
  return getTokenSigner(key)
}
