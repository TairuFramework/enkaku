import type { Schema } from '@enkaku/schema'

export type EventCommandProtocol = {
  type: 'event'
  data?: Schema
}

export type RequestCommandProtocol = {
  type: 'request'
  params?: Schema
  result?: Schema
}

export type StreamCommandProtocol = {
  type: 'stream'
  params?: Schema
  receive: Schema
  result?: Schema
}

export type ChannelCommandProtocol = {
  type: 'channel'
  params?: Schema
  send: Schema
  receive: Schema
  result?: Schema
}

export type AnyCommandProtocol =
  | EventCommandProtocol
  | RequestCommandProtocol
  | StreamCommandProtocol
  | ChannelCommandProtocol

export type CommandsRecordProtocol<Commands extends string> = {
  [Command in Commands]: AnyCommandProtocol
}
