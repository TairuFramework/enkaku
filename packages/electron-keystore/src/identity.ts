import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { createFullIdentity, decodePrivateKey, type FullIdentity } from '@enkaku/token'
import { SpanStatusCode, trace } from '@opentelemetry/api'

import { ElectronKeyStore } from './store.js'

const tracer = trace.getTracer('enkaku.keystore.electron')
const logger = getEnkakuLogger('electron-keystore')

function getStore(store: ElectronKeyStore | string): ElectronKeyStore {
  return typeof store === 'string' ? ElectronKeyStore.open(store) : store
}

export function provideFullIdentity(store: ElectronKeyStore | string, keyID: string): FullIdentity {
  const span = tracer.startSpan(SpanNames.KEYSTORE_GET_OR_CREATE, {
    attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'electron' },
  })
  try {
    const entry = getStore(store).entry(keyID)
    const existing = entry.get()
    if (existing != null) {
      const identity = createFullIdentity(decodePrivateKey(existing))
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
      span.setStatus({ code: SpanStatusCode.OK })
      return identity
    }
    const key = entry.provide()
    const identity = createFullIdentity(decodePrivateKey(key))
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

export async function provideFullIdentityAsync(
  store: ElectronKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  const span = tracer.startSpan(SpanNames.KEYSTORE_GET_OR_CREATE, {
    attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'electron' },
  })
  try {
    const entry = getStore(store).entry(keyID)
    const existing = await entry.getAsync()
    if (existing != null) {
      const identity = createFullIdentity(decodePrivateKey(existing))
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
      span.setStatus({ code: SpanStatusCode.OK })
      return identity
    }
    const key = await entry.provideAsync()
    const identity = createFullIdentity(decodePrivateKey(key))
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
