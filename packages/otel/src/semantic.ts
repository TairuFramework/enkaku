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
  TRANSPORT_SOCKET_CONNECT: 'enkaku.transport.socket.connect',
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
  TRANSPORT_SESSION_ID: 'enkaku.transport.session_id',

  // HTTP (standard OTel)
  HTTP_METHOD: 'http.method',
  HTTP_STATUS_CODE: 'http.status_code',

  // Network
  NET_PEER_NAME: 'net.peer.name',

  // Stream/Channel messaging
  STREAM_MESSAGE_INDEX: 'enkaku.stream.message_index',
  CHANNEL_MESSAGE_INDEX: 'enkaku.channel.message_index',
  MESSAGE_DIRECTION: 'enkaku.message.direction',

  // Validation
  VALIDATION_SUCCESS: 'enkaku.validation.success',
  VALIDATION_ERROR: 'enkaku.validation.error',

  // Error
  ERROR_CODE: 'enkaku.error.code',
  ERROR_MESSAGE: 'enkaku.error.message',
} as const
