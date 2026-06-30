import { describe, expect, test } from 'vitest'

import { createTracer, EnkakuAttributeKeys, EnkakuSpanNames } from '../src/index.js'

describe('EnkakuSpanNames', () => {
  test('client/server/transport span names are enkaku-prefixed', () => {
    expect(EnkakuSpanNames.CLIENT_CALL).toBe('enkaku.client.call')
    expect(EnkakuSpanNames.SERVER_HANDLE).toBe('enkaku.server.handle')
    expect(EnkakuSpanNames.SERVER_HANDLER).toBe('enkaku.server.handler')
    expect(EnkakuSpanNames.TRANSPORT_HTTP_REQUEST).toBe('enkaku.transport.http.request')
    expect(EnkakuSpanNames.TRANSPORT_SOCKET_CONNECT).toBe('enkaku.transport.socket.connect')
  })
})

describe('EnkakuAttributeKeys', () => {
  test('domain attrs are enkaku-prefixed', () => {
    expect(EnkakuAttributeKeys.AUTH_DID).toBe('enkaku.auth.did')
    expect(EnkakuAttributeKeys.AUTH_ALLOWED).toBe('enkaku.auth.allowed')
    expect(EnkakuAttributeKeys.AUTH_REASON).toBe('enkaku.auth.reason')
    expect(EnkakuAttributeKeys.ERROR_CODE).toBe('enkaku.error.code')
    expect(EnkakuAttributeKeys.VALIDATION_SUCCESS).toBe('enkaku.validation.success')
  })
})

describe('createTracer', () => {
  test('returns a Tracer', () => {
    expect(typeof createTracer('client').startSpan).toBe('function')
  })
})
