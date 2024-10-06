import type { ErrorObject } from './error.js'
import type { OptionalRecord } from './utils.js'

export type EventActionDefinition<Data extends OptionalRecord> = {
  type: 'event'
  data: Data
}

export type RequestActionDefinition<
  Params extends OptionalRecord,
  Result = unknown,
  Err extends ErrorObject = ErrorObject,
> = {
  type: 'request'
  params: Params
  result: Result
  error: Err
}

export type StreamActionDefinition<
  Params extends OptionalRecord,
  Receive = unknown,
  Result = unknown,
  Err extends ErrorObject = ErrorObject,
> = {
  type: 'stream'
  params: Params
  receive: Receive
  result: Result
  error: Err
}

export type ChannelActionDefinition<
  Params extends OptionalRecord,
  Send = unknown,
  Receive = unknown,
  Result = unknown,
  Err extends ErrorObject = ErrorObject,
> = {
  type: 'channel'
  params: Params
  send: Send
  receive: Receive
  result: Result
  error: Err
}

export type AnyActionDefinition =
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | EventActionDefinition<any>
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | RequestActionDefinition<any, any>
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | StreamActionDefinition<any, any, any>
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | ChannelActionDefinition<any, any, any, any>

export type AnyActionDefinitions<Names extends string = string> = {
  [Name in Names & string]: AnyActionDefinition
}
