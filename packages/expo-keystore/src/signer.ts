import { type TokenSigner, getTokenSigner } from '@enkaku/token'
import { getRandomBytes, getRandomBytesAsync } from 'expo-crypto'

import { getPrivateKey, getPrivateKeyAsync, savePrivateKey, savePrivateKeyAsync } from './store.js'

export function createSigner(): TokenSigner {
  const key = getRandomBytes(32)
  const signer = getTokenSigner(key)
  savePrivateKey(signer.id, key)
  return signer
}

export async function createSignerAsync(): Promise<TokenSigner> {
  const key = await getRandomBytesAsync(32)
  const signer = getTokenSigner(key)
  await savePrivateKeyAsync(signer.id, key)
  return signer
}

export function getSigner(did: string): TokenSigner | null {
  const key = getPrivateKey(did)
  return key ? getTokenSigner(key) : null
}

export async function getSignerAsync(did: string): Promise<TokenSigner | null> {
  const key = await getPrivateKeyAsync(did)
  return key ? getTokenSigner(key) : null
}
