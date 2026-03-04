import { fromB64, toB64 } from '@enkaku/codec'
import { getEnkakuLogger } from '@enkaku/log'
import type { KeyEntry } from '@enkaku/protocol'
import { CODECS, getDID } from '@enkaku/token'
import { ed25519 } from '@noble/curves/ed25519.js'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import * as SecureStore from 'expo-secure-store'

import { randomPrivateKey, randomPrivateKeyAsync } from './utils.js'

const tracer = trace.getTracer('enkaku.keystore')
const logger = getEnkakuLogger('keystore')

function safeGetDID(privateKey: Uint8Array): string | null {
  try {
    return getDID(CODECS.EdDSA, ed25519.getPublicKey(privateKey))
  } catch {
    return null
  }
}

export type StoreEntryOptions = SecureStore.SecureStoreOptions

export class ExpoKeyEntry implements KeyEntry<Uint8Array> {
  #keyID: string
  #options?: StoreEntryOptions

  constructor(keyID: string, options?: StoreEntryOptions) {
    this.#keyID = keyID
    this.#options = options
  }

  get keyID(): string {
    return this.#keyID
  }

  get(): Uint8Array | null {
    const privateKey = SecureStore.getItem(this.#keyID, this.#options)
    return privateKey ? fromB64(privateKey) : null
  }

  async getAsync(): Promise<Uint8Array | null> {
    const privateKey = await SecureStore.getItemAsync(this.#keyID, this.#options)
    return privateKey ? fromB64(privateKey) : null
  }

  set(privateKey: Uint8Array): void {
    SecureStore.setItem(this.#keyID, toB64(privateKey), this.#options)
  }

  async setAsync(privateKey: Uint8Array): Promise<void> {
    await SecureStore.setItemAsync(this.#keyID, toB64(privateKey), this.#options)
  }

  provide(): Uint8Array {
    const span = tracer.startSpan('enkaku.keystore.get_or_create', {
      attributes: { 'enkaku.keystore.store_type': 'expo' },
    })
    try {
      const existing = this.get()
      if (existing != null) {
        const did = safeGetDID(existing)
        if (did != null) {
          span.setAttribute('enkaku.auth.did', did)
        }
        span.setAttribute('enkaku.keystore.key_created', false)
        span.setStatus({ code: SpanStatusCode.OK })
        return existing
      }

      const privateKey = randomPrivateKey()
      this.set(privateKey)
      const did = safeGetDID(privateKey)
      if (did != null) {
        span.setAttribute('enkaku.auth.did', did)
        logger.info`New signing key generated ${{ did }}`
      }
      span.setAttribute('enkaku.keystore.key_created', true)
      span.setStatus({ code: SpanStatusCode.OK })
      return privateKey
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  }

  async provideAsync(): Promise<Uint8Array> {
    const span = tracer.startSpan('enkaku.keystore.get_or_create', {
      attributes: { 'enkaku.keystore.store_type': 'expo' },
    })
    try {
      const existing = await this.getAsync()
      if (existing != null) {
        const did = safeGetDID(existing)
        if (did != null) {
          span.setAttribute('enkaku.auth.did', did)
        }
        span.setAttribute('enkaku.keystore.key_created', false)
        span.setStatus({ code: SpanStatusCode.OK })
        return existing
      }

      const privateKey = await randomPrivateKeyAsync()
      await this.setAsync(privateKey)
      const did = safeGetDID(privateKey)
      if (did != null) {
        span.setAttribute('enkaku.auth.did', did)
        logger.info`New signing key generated ${{ did }}`
      }
      span.setAttribute('enkaku.keystore.key_created', true)
      span.setStatus({ code: SpanStatusCode.OK })
      return privateKey
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      span.end()
    }
  }

  async removeAsync(): Promise<void> {
    await SecureStore.deleteItemAsync(this.#keyID, this.#options)
  }
}
