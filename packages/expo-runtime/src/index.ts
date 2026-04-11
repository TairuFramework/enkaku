import type { GetRandomValues, Runtime } from '@enkaku/runtime'
// @ts-expect-error Expo import
import { fetch } from 'expo/fetch'
import { getRandomValues, randomUUID } from 'expo-crypto'

export const expoRuntime: Runtime = {
  fetch,
  getRandomID: randomUUID,
  getRandomValues: getRandomValues as GetRandomValues,
}

export function createRuntime(overrides?: Partial<Runtime>): Runtime {
  return {
    fetch: overrides?.fetch ?? expoRuntime.fetch,
    getRandomID: overrides?.getRandomID ?? expoRuntime.getRandomID,
    getRandomValues: overrides?.getRandomValues ?? expoRuntime.getRandomValues,
  }
}

export function polyfillCrypto(override = false) {
  if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {} as Crypto
  }
  if (override || typeof globalThis.crypto.getRandomValues !== 'function') {
    globalThis.crypto.getRandomValues = getRandomValues as Crypto['getRandomValues']
  }
  if (override || typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto.randomUUID = randomUUID as Crypto['randomUUID']
  }
}

export function polyfillFetch(override = false) {
  if (override || typeof globalThis.fetch !== 'function') {
    globalThis.fetch = fetch
  }
}

export function polyfill(override = false) {
  polyfillCrypto(override)
  polyfillFetch(override)
}
