import { fromB64, toB64 } from '@enkaku/codec'
import * as SecureStore from 'expo-secure-store'

function toStorageKey(did: string): string {
  return did.replace('did:key:', 'enkaku-key-')
}

export function getPrivateKey(did: string): Uint8Array | null {
  const privateKey = SecureStore.getItem(toStorageKey(did))
  return privateKey ? fromB64(privateKey) : null
}

export async function getPrivateKeyAsync(did: string): Promise<Uint8Array | null> {
  const privateKey = await SecureStore.getItemAsync(toStorageKey(did))
  return privateKey ? fromB64(privateKey) : null
}

export function savePrivateKey(did: string, privateKey: Uint8Array): void {
  SecureStore.setItem(toStorageKey(did), toB64(privateKey))
}

export async function savePrivateKeyAsync(did: string, privateKey: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(toStorageKey(did), toB64(privateKey))
}

export function deletePrivateKey(did: string): void {
  SecureStore.deleteItemAsync(did)
}

export async function deletePrivateKeyAsync(did: string): Promise<void> {
  await SecureStore.deleteItemAsync(did)
}
