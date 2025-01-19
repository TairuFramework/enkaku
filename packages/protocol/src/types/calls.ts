import type { ErrorObject } from '../schemas/error.js'
import type { RequestType } from '../schemas/protocol.js'

// Call payloads: from client to server

export type AbortCallPayload = {
  typ: 'abort'
  rid: string
  rsn?: string
}

export type EventCallPayload<
  Procedure extends string,
  Data extends Record<string, unknown> | undefined,
> = {
  typ: 'event'
  prc: Procedure
} & (Data extends undefined ? { data?: never } : { data: Data })

export type RequestCallPayload<Type extends RequestType, Procedure extends string, Params> = {
  typ: Type
  prc: Procedure
  rid: string
  prm: Params
}

export type SendCallPayload<Value> = {
  typ: 'send'
  rid: string
  val: Value
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
}

export type ErrorReplyPayloadOf<Error = unknown> = Error extends ErrorObject
  ? ErrorReplyPayload<Error['code'], Error['data']>
  : ErrorReplyPayload<string, Record<string, unknown>>

export type ReceiveReplyPayload<Value> = {
  typ: 'receive'
  rid: string
  val: Value
}

export type ResultReplyPayload<Value> = {
  typ: 'result'
  rid: string
  val: Value
}

export type UnknownReplyPayload =
  | ErrorReplyPayloadOf<unknown>
  | ReceiveReplyPayload<unknown>
  | ResultReplyPayload<unknown>
