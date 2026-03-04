import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, SpanNames } from '@enkaku/otel'
import { createFullIdentity, type FullIdentity } from '@enkaku/token'
import { SpanStatusCode, trace } from '@opentelemetry/api'

import { NodeKeyStore } from './store.js'

const tracer = trace.getTracer('enkaku.keystore.node')
const logger = getEnkakuLogger('node-keystore')

function getStore(store: NodeKeyStore | string): NodeKeyStore {
  return typeof store === 'string' ? NodeKeyStore.open(store) : store
}

export function provideFullIdentity(store: NodeKeyStore | string, keyID: string): FullIdentity {
  const span = tracer.startSpan(SpanNames.KEYSTORE_GET_OR_CREATE, {
    attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'node' },
  })
  try {
    const entry = getStore(store).entry(keyID)
    const existing = entry.get()
    if (existing != null) {
      const identity = createFullIdentity(existing)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
      span.setStatus({ code: SpanStatusCode.OK })
      return identity
    }
    const key = entry.provide()
    const identity = createFullIdentity(key)
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
  store: NodeKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  const span = tracer.startSpan(SpanNames.KEYSTORE_GET_OR_CREATE, {
    attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'node' },
  })
  try {
    const entry = getStore(store).entry(keyID)
    const existing = await entry.getAsync()
    if (existing != null) {
      const identity = createFullIdentity(existing)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
      span.setStatus({ code: SpanStatusCode.OK })
      return identity
    }
    const key = await entry.provideAsync()
    const identity = createFullIdentity(key)
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
