import { createFullIdentity, decodePrivateKey, type FullIdentity } from '@enkaku/token'

import { ElectronKeyStore } from './store.js'

function getStore(store: ElectronKeyStore | string): ElectronKeyStore {
  return typeof store === 'string' ? ElectronKeyStore.open(store) : store
}

export function provideFullIdentity(
  store: ElectronKeyStore | string,
  keyID: string,
): FullIdentity {
  const key = getStore(store).entry(keyID).provide()
  return createFullIdentity(decodePrivateKey(key))
}

export async function provideFullIdentityAsync(
  store: ElectronKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  const key = await getStore(store).entry(keyID).provideAsync()
  return createFullIdentity(decodePrivateKey(key))
}
