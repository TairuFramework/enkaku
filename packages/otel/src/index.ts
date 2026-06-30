import { createTracerFactory } from '@sozai/otel'

export const createTracer = createTracerFactory('enkaku')

export const EnkakuSpanNames = {
  CLIENT_CALL: 'enkaku.client.call',
  CLIENT_RESPONSE: 'enkaku.client.response',
  SERVER_HANDLE: 'enkaku.server.handle',
  SERVER_ACCESS_CONTROL: 'enkaku.server.access_control',
  SERVER_HANDLER: 'enkaku.server.handler',
  TRANSPORT_WRITE: 'enkaku.transport.write',
  TRANSPORT_HTTP_REQUEST: 'enkaku.transport.http.request',
  TRANSPORT_HTTP_SSE_CONNECT: 'enkaku.transport.http.sse_connect',
  TRANSPORT_WS_CONNECT: 'enkaku.transport.ws.connect',
  TRANSPORT_WS_MESSAGE: 'enkaku.transport.ws.message',
  TRANSPORT_SOCKET_CONNECT: 'enkaku.transport.socket.connect',
} as const

export const EnkakuAttributeKeys = {
  AUTH_DID: 'enkaku.auth.did',
  AUTH_ALLOWED: 'enkaku.auth.allowed',
  AUTH_REASON: 'enkaku.auth.reason',
  TRANSPORT_TYPE: 'enkaku.transport.type',
  TRANSPORT_SESSION_ID: 'enkaku.transport.session_id',
  MESSAGE_DIRECTION: 'enkaku.message.direction',
  STREAM_MESSAGE_INDEX: 'enkaku.stream.message_index',
  CHANNEL_MESSAGE_INDEX: 'enkaku.channel.message_index',
  VALIDATION_SUCCESS: 'enkaku.validation.success',
  VALIDATION_ERROR: 'enkaku.validation.error',
  ERROR_CODE: 'enkaku.error.code',
  ERROR_MESSAGE: 'enkaku.error.message',
} as const
