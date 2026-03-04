export const ZERO_TRACE_ID = '00000000000000000000000000000000'

export const SpanNames = {
  // Client
  CLIENT_CALL: 'enkaku.client.call',
  CLIENT_RESPONSE: 'enkaku.client.response',

  // Server
  SERVER_HANDLE: 'enkaku.server.handle',
  SERVER_ACCESS_CONTROL: 'enkaku.server.access_control',
  SERVER_HANDLER: 'enkaku.server.handler',

  // Token
  TOKEN_SIGN: 'enkaku.token.sign',
  TOKEN_VERIFY: 'enkaku.token.verify',

  // Keystore
  KEYSTORE_GET_OR_CREATE: 'enkaku.keystore.get_or_create',

  // Transport
  TRANSPORT_WRITE: 'enkaku.transport.write',
  TRANSPORT_HTTP_REQUEST: 'enkaku.transport.http.request',
  TRANSPORT_HTTP_SSE_CONNECT: 'enkaku.transport.http.sse_connect',
  TRANSPORT_WS_CONNECT: 'enkaku.transport.ws.connect',
  TRANSPORT_WS_MESSAGE: 'enkaku.transport.ws.message',
} as const

export const AttributeKeys = {
  // RPC (follows OTel semantic conventions)
  RPC_PROCEDURE: 'rpc.procedure',
  RPC_REQUEST_ID: 'rpc.request_id',
  RPC_TYPE: 'rpc.type',
  RPC_SYSTEM: 'rpc.system',

  // Auth
  AUTH_DID: 'enkaku.auth.did',
  AUTH_ALGORITHM: 'enkaku.auth.algorithm',
  AUTH_ALLOWED: 'enkaku.auth.allowed',
  AUTH_REASON: 'enkaku.auth.reason',

  // Keystore
  KEYSTORE_KEY_CREATED: 'enkaku.keystore.key_created',
  KEYSTORE_STORE_TYPE: 'enkaku.keystore.store_type',

  // Transport
  TRANSPORT_TYPE: 'enkaku.transport.type',

  // Error
  ERROR_CODE: 'enkaku.error.code',
  ERROR_MESSAGE: 'enkaku.error.message',
} as const
