import { fromB64, toB64 } from '@enkaku/codec'
import { getEnkakuLogger } from '@enkaku/log'
import type { KeyEntry } from '@enkaku/protocol'
import { CODECS, getDID, randomPrivateKey } from '@enkaku/token'
import { ed25519 } from '@noble/curves/ed25519.js'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { safeStorage } from 'electron'

import type { KeyStorage } from './types.js'

const tracer = trace.getTracer('enkaku.keystore')
const logger = getEnkakuLogger('keystore')

function safeGetDID(base64Key: string): string | null {
  try {
    return getDID(CODECS.EdDSA, ed25519.getPublicKey(fromB64(base64Key)))
  } catch {
    return null
  }
}

function encryptKey(encoded: string): string {
  return toB64(safeStorage.encryptString(encoded))
}

function decryptKey(encrypted: string): string {
  return safeStorage.decryptString(Buffer.from(fromB64(encrypted)))
}

// Stored as base64
export class ElectronKeyEntry implements KeyEntry<string> {
  #keyID: string
  #key?: string
  #storage: KeyStorage

  constructor(storage: KeyStorage, keyID: string, key?: string) {
    this.#keyID = keyID
    this.#key = key
    this.#storage = storage
  }

  get keyID(): string {
    return this.#keyID
  }

  getAsync(): Promise<string | null> {
    return Promise.resolve(this.get())
  }

  get(): string | null {
    if (this.#key != null) {
      return this.#key
    }
    const encrypted = this.#storage.getKeys()[this.#keyID]
    if (encrypted == null) {
      return null
    }
    const key = decryptKey(encrypted)
    if (key == null) {
      return null
    }
    this.#key = key
    return this.#key
  }

  setAsync(key: string): Promise<void> {
    return Promise.resolve(this.set(key))
  }

  set(key: string): void {
    const encrypted = encryptKey(key)
    this.#storage.setKeys({ [this.#keyID]: encrypted })
    this.#key = key
  }

  provideAsync(): Promise<string> {
    return Promise.resolve(this.provide())
  }

  provide(): string {
    const span = tracer.startSpan('enkaku.keystore.get_or_create', {
      attributes: { 'enkaku.keystore.store_type': 'electron' },
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

      const privateKey = toB64(randomPrivateKey())
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

  removeAsync(): Promise<void> {
    return Promise.resolve(this.remove())
  }

  remove(): void {
    const { [this.#keyID]: _, ...keys } = this.#storage.getKeys()
    this.#storage.setKeys(keys)
    this.#key = undefined
  }
}
