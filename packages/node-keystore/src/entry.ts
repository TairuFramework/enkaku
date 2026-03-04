import { fromB64, toB64 } from '@enkaku/codec'
import { getEnkakuLogger } from '@enkaku/log'
import type { KeyEntry } from '@enkaku/protocol'
import { CODECS, getDID, randomPrivateKey } from '@enkaku/token'
import { AsyncEntry, Entry } from '@napi-rs/keyring'
import { ed25519 } from '@noble/curves/ed25519.js'
import { SpanStatusCode, trace } from '@opentelemetry/api'

const tracer = trace.getTracer('enkaku.keystore')
const logger = getEnkakuLogger('keystore')

function safeGetDID(privateKey: Uint8Array): string | null {
  try {
    return getDID(CODECS.EdDSA, ed25519.getPublicKey(privateKey))
  } catch {
    return null
  }
}

export class NodeKeyEntry implements KeyEntry<Uint8Array> {
  #async?: AsyncEntry
  #keyID: string
  #key?: Uint8Array
  #service: string
  #sync?: Entry

  constructor(service: string, keyID: string, key?: Uint8Array) {
    this.#service = service
    this.#keyID = keyID
    this.#key = key
  }

  get keyID(): string {
    return this.#keyID
  }

  get #asyncEntry(): AsyncEntry {
    this.#async ??= new AsyncEntry(this.#service, this.#keyID)
    return this.#async
  }

  get #syncEntry(): Entry {
    this.#sync ??= new Entry(this.#service, this.#keyID)
    return this.#sync
  }

  get(): Uint8Array | null {
    if (this.#key != null) {
      return this.#key
    }
    const encoded = this.#syncEntry.getPassword()
    if (encoded == null) {
      return null
    }
    this.#key = fromB64(encoded)
    return this.#key
  }

  async getAsync(): Promise<Uint8Array | null> {
    if (this.#key != null) {
      return this.#key
    }
    const encoded = await this.#asyncEntry.getPassword()
    if (encoded == null) {
      return null
    }
    this.#key = fromB64(encoded)
    return this.#key
  }

  set(key: Uint8Array): void {
    this.#syncEntry.setPassword(toB64(key))
    this.#key = key
  }

  async setAsync(key: Uint8Array): Promise<void> {
    await this.#asyncEntry.setPassword(toB64(key))
    this.#key = key
  }

  provide(): Uint8Array {
    const span = tracer.startSpan('enkaku.keystore.get_or_create', {
      attributes: { 'enkaku.keystore.store_type': 'node' },
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
      attributes: { 'enkaku.keystore.store_type': 'node' },
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

      const privateKey = randomPrivateKey()
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

  remove(): void {
    this.#syncEntry.deletePassword()
    this.#key = undefined
  }

  async removeAsync(): Promise<void> {
    await this.#asyncEntry.deletePassword()
    this.#key = undefined
  }
}
