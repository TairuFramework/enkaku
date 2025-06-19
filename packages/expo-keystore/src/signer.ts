import { getTokenSigner, type TokenSigner } from '@enkaku/token'

import { ExpoKeyStore } from './store.js'

export function provideTokenSigner(keyID: string): TokenSigner {
  const key = ExpoKeyStore.entry(keyID).provide()
  return getTokenSigner(key)
}

export async function provideTokenSignerAsync(keyID: string): Promise<TokenSigner> {
  const key = await ExpoKeyStore.entry(keyID).provideAsync()
  return getTokenSigner(key)
}
