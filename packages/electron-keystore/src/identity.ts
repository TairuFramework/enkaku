import { getEnkakuLogger } from '@enkaku/log'
import { AttributeKeys, createTracer, SpanNames, withSpan, withSyncSpan } from '@enkaku/otel'
import { createFullIdentity, decodePrivateKey, type FullIdentity } from '@enkaku/token'

import { ElectronKeyStore } from './store.js'

const tracer = createTracer('keystore.electron')
const logger = getEnkakuLogger('electron-keystore')

function getStore(store: ElectronKeyStore | string): ElectronKeyStore {
  return typeof store === 'string' ? ElectronKeyStore.open(store) : store
}

export function provideFullIdentity(store: ElectronKeyStore | string, keyID: string): FullIdentity {
  return withSyncSpan(
    tracer,
    SpanNames.KEYSTORE_GET_OR_CREATE,
    { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'electron' } },
    (span) => {
      const entry = getStore(store).entry(keyID)
      const existing = entry.get()
      if (existing != null) {
        const identity = createFullIdentity(decodePrivateKey(existing))
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
        return identity
      }
      const key = entry.provide()
      const identity = createFullIdentity(decodePrivateKey(key))
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
      logger.info('New signing key generated {did}', { did: identity.id })
      return identity
    },
  )
}

export async function provideFullIdentityAsync(
  store: ElectronKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  return withSpan(
    tracer,
    SpanNames.KEYSTORE_GET_OR_CREATE,
    { attributes: { [AttributeKeys.KEYSTORE_STORE_TYPE]: 'electron' } },
    async (span) => {
      const entry = getStore(store).entry(keyID)
      const existing = await entry.getAsync()
      if (existing != null) {
        const identity = createFullIdentity(decodePrivateKey(existing))
        span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
        span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, false)
        return identity
      }
      const key = await entry.provideAsync()
      const identity = createFullIdentity(decodePrivateKey(key))
      span.setAttribute(AttributeKeys.AUTH_DID, identity.id)
      span.setAttribute(AttributeKeys.KEYSTORE_KEY_CREATED, true)
      logger.info('New signing key generated {did}', { did: identity.id })
      return identity
    },
  )
}
