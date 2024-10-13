import type { ErrorObject } from './error.js'

export type EventDefinition<Data extends Record<string, unknown> = Record<string, unknown>> = {
  type: 'event'
  data: Data
}

export type RequestDefinition<
  Params = unknown,
  Result = unknown,
  Err extends ErrorObject = ErrorObject,
> = {
  type: 'request'
  params: Params
  result: Result
  error: Err
}

export type StreamDefinition<
  Params = unknown,
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

export type ChannelDefinition<
  Params = unknown,
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

export type AnyDefinition =
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | EventDefinition<any>
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | RequestDefinition<any, any>
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | StreamDefinition<any, any, any>
  // biome-ignore lint/suspicious/noExplicitAny: what else could it be?
  | ChannelDefinition<any, any, any, any>

export type AnyDefinitions<Commands extends string = string> = {
  [Command in Commands & string]: AnyDefinition
}
