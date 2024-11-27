import type {
  AnyDefinitions,
  ChannelDefinition,
  EventDefinition,
  RequestDefinition,
  StreamDefinition,
} from './definitions.js'
import type {
  AbortCallPayload,
  ErrorReplyPayload,
  EventCallPayload,
  ReceiveReplyPayload,
  RequestCallPayload,
  ResultReplyPayload,
  SendCallPayload,
} from './invocations.js'

// Client payloads

export type EventPayloadOf<Command extends string, Definition> = Definition extends EventDefinition<
  infer Data
>
  ? EventCallPayload<Command, Data>
  : never

export type RequestPayloadOf<
  Command extends string,
  Definition,
> = Definition extends RequestDefinition<infer Params>
  ? RequestCallPayload<'request', Command, Params>
  : never

export type StreamPayloadOf<
  Command extends string,
  Definition,
> = Definition extends StreamDefinition<infer Params>
  ? RequestCallPayload<'stream', Command, Params>
  : never

export type ChannelPayloadOf<
  Command extends string,
  Definition,
> = Definition extends ChannelDefinition<infer Params>
  ? RequestCallPayload<'channel', Command, Params>
  : never

export type SendPayloadOf<Definition> = Definition extends ChannelDefinition<
  infer Params,
  infer Send
>
  ? SendCallPayload<Send>
  : never

export type ClientPayloadOf<
  Command extends string,
  Definition,
> = Definition extends EventDefinition<infer Data>
  ? EventCallPayload<Command, Data>
  : Definition extends RequestDefinition<infer Params>
    ? RequestCallPayload<'request', Command, Params> | AbortCallPayload
    : Definition extends StreamDefinition<infer Params>
      ? RequestCallPayload<'stream', Command, Params> | AbortCallPayload
      : Definition extends ChannelDefinition<infer Params, infer Send>
        ? RequestCallPayload<'channel', Command, Params> | SendCallPayload<Send> | AbortCallPayload
        : never

export type ClientPayloadRecordsOf<Definitions extends AnyDefinitions> = {
  [Command in keyof Definitions & string]: ClientPayloadOf<Command, Definitions[Command]>
}

// Server payloads

export type ErrorPayloadOf<Definition> = Definition extends RequestDefinition<
  infer Params,
  infer Result,
  infer Err
>
  ? ErrorReplyPayload<Err['code'], Err['data']>
  : Definition extends StreamDefinition<infer Params, infer Receive, infer Result, infer Err>
    ? ErrorReplyPayload<Err['code'], Err['data']>
    : Definition extends ChannelDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result,
          infer Err
        >
      ? ErrorReplyPayload<Err['code'], Err['data']>
      : never

export type ResultPayloadOf<Definition> = Definition extends RequestDefinition<
  infer Params,
  infer Result
>
  ? ResultReplyPayload<Result>
  : Definition extends StreamDefinition<infer Params, infer Receive, infer Result>
    ? ResultReplyPayload<Result>
    : Definition extends ChannelDefinition<infer Params, infer Send, infer Receive, infer Result>
      ? ResultReplyPayload<Result>
      : never

export type ReceiveActionPayloadOf<Definition> = Definition extends StreamDefinition<
  infer Params,
  infer Receive
>
  ? ReceiveReplyPayload<Receive>
  : Definition extends ChannelDefinition<infer Params, infer Send, infer Receive>
    ? ReceiveReplyPayload<Receive>
    : never

export type ServerPayloadOf<Definition> = Definition extends RequestDefinition<
  infer Params,
  infer Result,
  infer Err
>
  ? ResultReplyPayload<Result> | ErrorReplyPayload<Err['code'], Err['data']>
  : Definition extends StreamDefinition<infer Params, infer Receive, infer Result, infer Err>
    ?
        | ReceiveReplyPayload<Receive>
        | ResultReplyPayload<Result>
        | ErrorReplyPayload<Err['code'], Err['data']>
    : Definition extends ChannelDefinition<
          infer Params,
          infer Send,
          infer Receive,
          infer Result,
          infer Err
        >
      ?
          | ReceiveReplyPayload<Receive>
          | ResultReplyPayload<Result>
          | ErrorReplyPayload<Err['code'], Err['data']>
      : never

export type ServerPayloadRecordsOf<Definitions extends AnyDefinitions> = {
  [Command in keyof Definitions & string]: ServerPayloadOf<Definitions[Command]>
}
