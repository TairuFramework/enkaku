import { getRandomBytes, getRandomBytesAsync } from 'expo-crypto'

export function randomPrivateKey(): Uint8Array {
  return getRandomBytes(32)
}

export function randomPrivateKeyAsync(): Promise<Uint8Array> {
  return getRandomBytesAsync(32)
}
