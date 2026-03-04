import { getEnkakuLogger } from '@enkaku/log'
import { createFullIdentity, type FullIdentity } from '@enkaku/token'
import { SpanStatusCode, trace } from '@opentelemetry/api'

import { ExpoKeyStore } from './store.js'

const tracer = trace.getTracer('enkaku.keystore')
const logger = getEnkakuLogger('keystore')

export function provideFullIdentity(keyID: string): FullIdentity {
  const span = tracer.startSpan('enkaku.keystore.get_or_create', {
    attributes: { 'enkaku.keystore.store_type': 'expo' },
  })
  try {
    const entry = ExpoKeyStore.entry(keyID)
    const keyCreated = entry.get() == null
    const key = entry.provide()
    const identity = createFullIdentity(key)
    span.setAttribute('enkaku.auth.did', identity.id)
    span.setAttribute('enkaku.keystore.key_created', keyCreated)
    if (keyCreated) {
      logger.info`New signing key generated ${{ did: identity.id }}`
    }
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

export async function provideFullIdentityAsync(keyID: string): Promise<FullIdentity> {
  const span = tracer.startSpan('enkaku.keystore.get_or_create', {
    attributes: { 'enkaku.keystore.store_type': 'expo' },
  })
  try {
    const entry = ExpoKeyStore.entry(keyID)
    const keyCreated = (await entry.getAsync()) == null
    const key = await entry.provideAsync()
    const identity = createFullIdentity(key)
    span.setAttribute('enkaku.auth.did', identity.id)
    span.setAttribute('enkaku.keystore.key_created', keyCreated)
    if (keyCreated) {
      logger.info`New signing key generated ${{ did: identity.id }}`
    }
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
