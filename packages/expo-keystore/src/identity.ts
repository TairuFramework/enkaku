import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, createTracer, SpanNames, withSpan, withSyncSpan } from '@enkaku/otel'
import { createFullIdentity, type FullIdentity } from '@enkaku/token'

import { ExpoKeyStore } from './store.js'

const tracer = createTracer('keystore.expo')
const logger = getEnkakuLogger('expo-keystore')

export function provideFullIdentity(keyID: string): FullIdentity {
  return withSyncSpan(
    tracer,
    SpanNames.KEYSTORE_GET_OR_CREATE,
    { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'expo' } },
    (span) => {
      const entry = ExpoKeyStore.entry(keyID)
      const existing = entry.get()
      if (existing != null) {
        const identity = createFullIdentity(existing)
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
        return identity
      }
      const key = entry.provide()
      const identity = createFullIdentity(key)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
      logger.info('New signing key generated {did}', { did: identity.id })
      return identity
    },
  )
}

export async function provideFullIdentityAsync(keyID: string): Promise<FullIdentity> {
  return withSpan(
    tracer,
    SpanNames.KEYSTORE_GET_OR_CREATE,
    { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'expo' } },
    async (span) => {
      const entry = ExpoKeyStore.entry(keyID)
      const existing = await entry.getAsync()
      if (existing != null) {
        const identity = createFullIdentity(existing)
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
        return identity
      }
      const key = await entry.provideAsync()
      const identity = createFullIdentity(key)
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
      logger.info('New signing key generated {did}', { did: identity.id })
      return identity
    },
  )
}
