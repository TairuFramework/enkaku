import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import {
  CODECS,
  getDID,
  type SignedHeader,
  type SignedToken,
  type SigningIdentity,
} from '@enkaku/token'
import { SpanStatusCode, trace } from '@opentelemetry/api'

import { BrowserKeyStore } from './store.js'
import { getPublicKey } from './utils.js'

const tracer = trace.getTracer('enkaku.keystore.browser')
const logger = getEnkakuLogger('browser-keystore')

async function createBrowserSigningIdentity(keyPair: CryptoKeyPair): Promise<SigningIdentity> {
  const publicKey = await getPublicKey(keyPair)
  const id = getDID(CODECS.ES256, publicKey)

  async function signToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    if (payload.iss != null && payload.iss !== id) {
      throw new Error('Invalid payload: issuer does not match signer')
    }

    const fullHeader = { ...header, typ: 'JWT', alg: 'ES256' } as SignedHeader & Header
    const fullPayload = { ...payload, iss: id }
    const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

    const messageBytes = fromUTF(data)
    const signatureBuffer = await globalThis.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      messageBytes.buffer as ArrayBuffer,
    )

    return {
      header: fullHeader,
      payload: fullPayload,
      signature: toB64U(new Uint8Array(signatureBuffer)),
      data,
    }
  }

  return { id, signToken }
}

export async function provideSigningIdentity(
  keyID: string,
  useStore?: BrowserKeyStore | Promise<BrowserKeyStore> | string,
): Promise<SigningIdentity> {
  const span = tracer.startSpan(SpanNames.KEYSTORE_GET_OR_CREATE, {
    attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'browser' },
  })
  try {
    const storePromise =
      useStore == null || typeof useStore === 'string'
        ? BrowserKeyStore.open(useStore)
        : Promise.resolve(useStore)
    const store = await storePromise
    const entry = store.entry(keyID)
    const existing = await entry.getAsync()
    if (existing != null) {
      const identity = await createBrowserSigningIdentity(existing)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
      span.setStatus({ code: SpanStatusCode.OK })
      return identity
    }
    const keyPair = await entry.provideAsync()
    const identity = await createBrowserSigningIdentity(keyPair)
    span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
    span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
    logger.info('New signing key generated {did}', { did: identity.id })
    span.setStatus({ code: SpanStatusCode.OK })
    return identity
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
