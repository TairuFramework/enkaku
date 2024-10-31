// Call payloads: from client to server

export type AbortCallPayload = {
  typ: 'abort'
  rid: string
  aud?: string
  jti?: string
  cap?: string | Array<string>
  exp?: number
  iat?: number
}

export type EventCallPayload<
  Command extends string,
  Data extends Record<string, unknown> | undefined,
> = {
  typ: 'event'
  cmd: Command
  aud?: string
  jti?: string
  cap?: string | Array<string>
  exp?: number
  iat?: number
} & (Data extends undefined ? { data?: never } : { data: Data })

export type RequestType = 'request' | 'stream' | 'channel'

export type RequestCallPayload<Type extends RequestType, Command extends string, Params> = {
  typ: Type
  cmd: Command
  rid: string
  prm: Params
  aud?: string
  jti?: string
  cap?: string | Array<string>
  exp?: number
  iat?: number
}

export type SendCallPayload<Value> = {
  typ: 'send'
  rid: string
  val: Value
  aud?: string
  jti?: string
  cap?: string | Array<string>
  exp?: number
  iat?: number
}

export type UnknownCallPayload =
  | AbortCallPayload
  | EventCallPayload<string, Record<string, unknown> | undefined>
  | RequestCallPayload<RequestType, string, unknown>
  | SendCallPayload<unknown>

// Reply payloads: from server to client

export type ErrorReplyPayload<
  Code extends string,
  Data extends Record<string, unknown> | undefined,
> = {
  typ: 'error'
  rid: string
  code: Code
  msg: string
  data: Data
  jti?: string
}

export type ReceiveReplyPayload<Value> = {
  typ: 'receive'
  rid: string
  val: Value
  jti?: string
}

export type ResultReplyPayload<Value> = {
  typ: 'result'
  rid: string
  val: Value
  jti?: string
}

export type UnknownReplyPayload =
  | ErrorReplyPayload<string, Record<string, unknown> | undefined>
  | ReceiveReplyPayload<unknown>
  | ResultReplyPayload<unknown>
