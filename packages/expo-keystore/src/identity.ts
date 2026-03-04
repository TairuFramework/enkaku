import { createFullIdentity, type FullIdentity } from '@enkaku/token'

import { ExpoKeyStore } from './store.js'

export function provideFullIdentity(keyID: string): FullIdentity {
  const key = ExpoKeyStore.entry(keyID).provide()
  return createFullIdentity(key)
}

export async function provideFullIdentityAsync(keyID: string): Promise<FullIdentity> {
  const key = await ExpoKeyStore.entry(keyID).provideAsync()
  return createFullIdentity(key)
}
