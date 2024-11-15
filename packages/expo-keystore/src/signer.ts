import { type TokenSigner, getTokenSigner } from '@enkaku/token'

import { get, getAsync } from './store.js'

export function loadSigner(keyID?: string): TokenSigner {
  return getTokenSigner(get(keyID))
}

export async function loadSignerAsync(keyID?: string): Promise<TokenSigner> {
  const key = await getAsync(keyID)
  return getTokenSigner(key)
}
