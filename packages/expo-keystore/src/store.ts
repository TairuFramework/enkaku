import { fromB64, toB64 } from '@enkaku/codec'
import { getRandomBytes, getRandomBytesAsync } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const DEFAULT_ID = 'default'

export function set(privateKey: Uint8Array, id = DEFAULT_ID): void {
  SecureStore.setItem(id, toB64(privateKey))
}

export async function setAsync(privateKey: Uint8Array, id = DEFAULT_ID): Promise<void> {
  await SecureStore.setItemAsync(id, toB64(privateKey))
}

function create(id: string): Uint8Array {
  const key = getRandomBytes(32)
  set(key, id)
  return key
}

async function createAsync(id: string): Promise<Uint8Array> {
  const key = await getRandomBytesAsync(32)
  await setAsync(key, id)
  return key
}

export function get(id = DEFAULT_ID): Uint8Array {
  const privateKey = SecureStore.getItem(id)
  return privateKey ? fromB64(privateKey) : create(id)
}

export async function getAsync(id = DEFAULT_ID): Promise<Uint8Array> {
  const privateKey = await SecureStore.getItemAsync(id)
  return privateKey ? fromB64(privateKey) : await createAsync(id)
}

export function reset(id = DEFAULT_ID): Uint8Array {
  return create(id)
}

export async function resetAsync(id = DEFAULT_ID): Promise<Uint8Array> {
  return await createAsync(id)
}

export async function removeAsync(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(id)
}
