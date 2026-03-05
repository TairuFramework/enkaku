import { describe, expect, test } from 'vitest'

import { AttributeKeys, SpanNames } from '../src/semantic.js'

describe('SpanNames', () => {
  test('has client span names', () => {
    expect(SpanNames.CLIENT_CALL).toBe('enkaku.client.call')
    expect(SpanNames.CLIENT_RESPONSE).toBe('enkaku.client.response')
  })

  test('has server span names', () => {
    expect(SpanNames.SERVER_HANDLE).toBe('enkaku.server.handle')
    expect(SpanNames.SERVER_ACCESS_CONTROL).toBe('enkaku.server.access_control')
    expect(SpanNames.SERVER_HANDLER).toBe('enkaku.server.handler')
  })

  test('has token span names', () => {
    expect(SpanNames.TOKEN_SIGN).toBe('enkaku.token.sign')
    expect(SpanNames.TOKEN_VERIFY).toBe('enkaku.token.verify')
  })

  test('has keystore span names', () => {
    expect(SpanNames.KEYSTORE_GET_OR_CREATE).toBe('enkaku.keystore.get_or_create')
  })

  test('has transport span names', () => {
    expect(SpanNames.TRANSPORT_WRITE).toBe('enkaku.transport.write')
    expect(SpanNames.TRANSPORT_HTTP_REQUEST).toBe('enkaku.transport.http.request')
    expect(SpanNames.TRANSPORT_HTTP_SSE_CONNECT).toBe('enkaku.transport.http.sse_connect')
    expect(SpanNames.TRANSPORT_WS_CONNECT).toBe('enkaku.transport.ws.connect')
    expect(SpanNames.TRANSPORT_WS_MESSAGE).toBe('enkaku.transport.ws.message')
  })

  test('has socket transport span name', () => {
    expect(SpanNames.TRANSPORT_SOCKET_CONNECT).toBe('enkaku.transport.socket.connect')
  })
})

describe('AttributeKeys', () => {
  test('has RPC attributes', () => {
    expect(AttributeKeys.RPC_PROCEDURE).toBe('rpc.procedure')
    expect(AttributeKeys.RPC_REQUEST_ID).toBe('rpc.request_id')
    expect(AttributeKeys.RPC_TYPE).toBe('rpc.type')
    expect(AttributeKeys.RPC_SYSTEM).toBe('rpc.system')
  })

  test('has auth attributes', () => {
    expect(AttributeKeys.AUTH_DID).toBe('enkaku.auth.did')
    expect(AttributeKeys.AUTH_ALGORITHM).toBe('enkaku.auth.algorithm')
    expect(AttributeKeys.AUTH_ALLOWED).toBe('enkaku.auth.allowed')
    expect(AttributeKeys.AUTH_REASON).toBe('enkaku.auth.reason')
  })

  test('has keystore attributes', () => {
    expect(AttributeKeys.KEYSTORE_KEY_CREATED).toBe('enkaku.keystore.key_created')
    expect(AttributeKeys.KEYSTORE_STORE_TYPE).toBe('enkaku.keystore.store_type')
  })

  test('has transport attributes', () => {
    expect(AttributeKeys.TRANSPORT_TYPE).toBe('enkaku.transport.type')
  })

  test('has transport session ID attribute', () => {
    expect(AttributeKeys.TRANSPORT_SESSION_ID).toBe('enkaku.transport.session_id')
  })

  test('has HTTP attributes', () => {
    expect(AttributeKeys.HTTP_METHOD).toBe('http.method')
    expect(AttributeKeys.HTTP_STATUS_CODE).toBe('http.status_code')
  })

  test('has network attributes', () => {
    expect(AttributeKeys.NET_PEER_NAME).toBe('net.peer.name')
  })

  test('has stream message index attribute', () => {
    expect(AttributeKeys.STREAM_MESSAGE_INDEX).toBe('enkaku.stream.message_index')
  })

  test('has channel message index attribute', () => {
    expect(AttributeKeys.CHANNEL_MESSAGE_INDEX).toBe('enkaku.channel.message_index')
  })

  test('has message direction attribute', () => {
    expect(AttributeKeys.MESSAGE_DIRECTION).toBe('enkaku.message.direction')
  })

  test('has validation success attribute', () => {
    expect(AttributeKeys.VALIDATION_SUCCESS).toBe('enkaku.validation.success')
  })

  test('has validation error attribute', () => {
    expect(AttributeKeys.VALIDATION_ERROR).toBe('enkaku.validation.error')
  })

  test('has error attributes', () => {
    expect(AttributeKeys.ERROR_CODE).toBe('enkaku.error.code')
    expect(AttributeKeys.ERROR_MESSAGE).toBe('enkaku.error.message')
  })
})
