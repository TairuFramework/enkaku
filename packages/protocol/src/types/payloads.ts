import type {
  ChannelActionDefinition,
  EventActionDefinition,
  RequestActionDefinition,
  StreamActionDefinition,
} from './definitions.js'
import type { OptionalRecord } from './utils.js'

// Client payloads

export type AbortActionPayload<Reason extends string | undefined = undefined> = {
  type: 'abort'
  id: string
  reason: Reason
}

export type EventActionPayload<Name extends string, Data extends OptionalRecord> = {
  type: 'event'
  name: Name
  data: Data
}

export type EventActionPayloadOf<
  Name extends string,
  Definition,
> = Definition extends EventActionDefinition<infer Data> ? EventActionPayload<Name, Data> : never

export type RequestActionPayload<Name extends string, Params extends OptionalRecord> = {
  type: 'request'
  name: Name
  id: string
  params: Params
}

export type RequestActionPayloadOf<
  Name extends string,
  Definition,
> = Definition extends RequestActionDefinition<infer Params extends OptionalRecord>
  ? RequestActionPayload<Name, Params>
  : never

export type StreamActionPayload<Name extends string, Params extends OptionalRecord> = {
  type: 'stream'
  name: Name
  id: string
  params: Params
}

export type StreamActionPayloadOf<
  Name extends string,
  Definition,
> = Definition extends StreamActionDefinition<infer Params extends OptionalRecord>
  ? StreamActionPayload<Name, Params>
  : never

export type ChannelActionPayload<Name extends string, Params extends OptionalRecord> = {
  type: 'channel'
  name: Name
  id: string
  params: Params
}

export type ChannelActionPayloadOf<
  Name extends string,
  Definition,
> = Definition extends ChannelActionDefinition<infer Params extends OptionalRecord>
  ? ChannelActionPayload<Name, Params>
  : never

export type SendActionPayload<Value> = {
  type: 'send'
  id: string
  value: Value
}

export type SendActionPayloadOf<Definition> = Definition extends ChannelActionDefinition<
  infer Params,
  infer Send
>
  ? SendActionPayload<Send>
  : never

export type ClientActionPayloadOf<
  Name extends string,
  Definition,
> = Definition extends EventActionDefinition<infer Data>
  ? EventActionPayload<Name, Data>
  : Definition extends RequestActionDefinition<infer Params extends OptionalRecord>
    ? RequestActionPayload<Name, Params> | AbortActionPayload
    : Definition extends StreamActionDefinition<infer Params extends OptionalRecord>
      ? StreamActionPayload<Name, Params> | AbortActionPayload
      : Definition extends ChannelActionDefinition<infer Params extends OptionalRecord, infer Send>
        ? ChannelActionPayload<Name, Params> | SendActionPayload<Send>
        : never

export type ClientActionPayloadRecordsOf<Definitions> = Definitions extends Record<
  infer Names extends string,
  unknown
>
  ? { [Name in Names & string]: ClientActionPayloadOf<Name, Definitions[Name]> }
  : Record<string, never>

// Server payloads

export type ErrorActionPayload<Err> = {
  type: 'error'
  id: string
  error: Err
}

export type ErrorActionPayloadOf<Definition> = Definition extends RequestActionDefinition<
  infer Params,
  infer Result,
  infer Err
>
  ? ErrorActionPayload<Err>
  : Definition extends StreamActionDefinition<infer Params, infer Receive, infer Result, infer Err>
    ? ErrorActionPayload<Err>
    : Definition extends ChannelActionDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result,
          infer Err
        >
      ? ErrorActionPayload<Err>
      : never

export type ResultActionPayload<Value> = {
  type: 'result'
  id: string
  value: Value
}

export type ResultActionPayloadOf<Definition> = Definition extends RequestActionDefinition<
  infer Result
>
  ? ResultActionPayload<Result>
  : Definition extends StreamActionDefinition<infer Params, infer Result>
    ? ResultActionPayload<Result>
    : Definition extends ChannelActionDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result
        >
      ? ResultActionPayload<Result>
      : never

export type ReceiveActionPayload<Value> = {
  type: 'receive'
  id: string
  value: Value
}

export type ReceiveActionPayloadOf<Definition> = Definition extends StreamActionDefinition<
  infer Params,
  infer Receive
>
  ? ReceiveActionPayload<Receive>
  : Definition extends ChannelActionDefinition<infer Params, infer Send, infer Receive>
    ? ReceiveActionPayload<Receive>
    : never

export type ServerActionPayloadOf<Definition> = Definition extends RequestActionDefinition<
  infer Params,
  infer Result,
  infer Err
>
  ? ResultActionPayload<Result> | ErrorActionPayload<Err>
  : Definition extends StreamActionDefinition<infer Params, infer Receive, infer Result, infer Err>
    ? ReceiveActionPayload<Receive> | ResultActionPayload<Result> | ErrorActionPayload<Err>
    : Definition extends ChannelActionDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result,
          infer Err
        >
      ? ReceiveActionPayload<Receive> | ResultActionPayload<Result> | ErrorActionPayload<Err>
      : never

export type ServerActionPayloadRecordsOf<Definitions> = Definitions extends Record<
  infer Names extends string,
  unknown
>
  ? { [Name in Names & string]: ServerActionPayloadOf<Definitions[Name]> }
  : Record<string, never>
