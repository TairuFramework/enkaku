import { getEnkakuLogger } from '@enkaku/log'
import type { KeyEntry } from '@enkaku/protocol'
import { CODECS, getDID } from '@enkaku/token'
import { SpanStatusCode, trace } from '@opentelemetry/api'

import { getPublicKey, randomKeyPair } from './utils.js'

const tracer = trace.getTracer('enkaku.keystore')
const logger = getEnkakuLogger('keystore')

async function safeGetDID(keyPair: CryptoKeyPair): Promise<string | null> {
  try {
    const publicKey = await getPublicKey(keyPair)
    return getDID(CODECS.ES256, publicKey)
  } catch {
    return null
  }
}

export type GetStore = (mode?: IDBTransactionMode) => IDBObjectStore

export class BrowserKeyEntry implements KeyEntry<CryptoKeyPair> {
  #getStore: GetStore
  #keyID: string

  constructor(keyID: string, getStore: GetStore) {
    this.#getStore = getStore
    this.#keyID = keyID
  }

  get keyID(): string {
    return this.#keyID
  }

  getAsync(): Promise<CryptoKeyPair | null> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore().get(this.#keyID)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? null)
    })
  }

  setAsync(keyPair: CryptoKeyPair): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = this.#getStore('readwrite').put(keyPair, this.#keyID)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async provideAsync(): Promise<CryptoKeyPair> {
    const span = tracer.startSpan('enkaku.keystore.get_or_create', {
      attributes: { 'enkaku.keystore.store_type': 'browser' },
    })
    try {
      const existing = await this.getAsync()
      const keyCreated = existing == null
      const keyPair = existing ?? (await randomKeyPair())
      if (keyCreated) {
        await this.setAsync(keyPair)
      }

      const did = await safeGetDID(keyPair)
      if (did != null) {
        span.setAttribute('enkaku.auth.did', did)
        if (keyCreated) {
          logger.info`New signing key generated ${{ did }}`
        }
      }
      span.setAttribute('enkaku.keystore.key_created', keyCreated)
      span.setStatus({ code: SpanStatusCode.OK })
      return keyPair
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
    return new Promise((resolve, reject) => {
      const request = this.#getStore('readwrite').delete(this.#keyID)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}
