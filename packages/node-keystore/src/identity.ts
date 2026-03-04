import { createFullIdentity, type FullIdentity } from '@enkaku/token'

import { NodeKeyStore } from './store.js'

function getStore(store: NodeKeyStore | string): NodeKeyStore {
  return typeof store === 'string' ? NodeKeyStore.open(store) : store
}

export function provideFullIdentity(store: NodeKeyStore | string, keyID: string): FullIdentity {
  const key = getStore(store).entry(keyID).provide()
  return createFullIdentity(key)
}

export async function provideFullIdentityAsync(
  store: NodeKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  const key = await getStore(store).entry(keyID).provideAsync()
  return createFullIdentity(key)
}
