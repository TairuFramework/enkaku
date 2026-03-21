import { getRandomValues } from 'expo-crypto'

// Polyfill crypto.getRandomValues for Hermes (React Native).
// Required by @noble/curves, @noble/ciphers, and the nobleCryptoProvider.
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {} as Crypto
}
if (typeof globalThis.crypto.getRandomValues !== 'function') {
  globalThis.crypto.getRandomValues = getRandomValues
}
