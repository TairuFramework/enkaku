import { type TokenSigner, getTokenSigner } from '@enkaku/token'

import { NodeKeyStore } from './store.js'

function getStore(store: NodeKeyStore | string): NodeKeyStore {
  return typeof store === 'string' ? NodeKeyStore.open(store) : store
}

export function provideTokenSigner(store: NodeKeyStore | string, keyID: string): TokenSigner {
  const key = getStore(store).entry(keyID).provide()
  return getTokenSigner(key)
}

export async function provideTokenSignerAsync(
  store: NodeKeyStore | string,
  keyID: string,
): Promise<TokenSigner> {
  const key = await getStore(store).entry(keyID).provideAsync()
  return getTokenSigner(key)
}
