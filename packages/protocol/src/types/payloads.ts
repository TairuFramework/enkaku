import type {
  AnyRequestCommandDefinition,
  ChannelCommandDefinition,
  EventCommandDefinition,
  ProtocolDefinition,
  RequestCommandDefinition,
  StreamCommandDefinition,
} from '../schemas/protocol.js'
import type {
  AbortCallPayload,
  ErrorReplyPayloadOf,
  EventCallPayload,
  ReceiveReplyPayload,
  RequestCallPayload,
  ResultReplyPayload,
  SendCallPayload,
} from './invocations.js'
import type { DataOf } from './utils.js'

// Client payloads

export type EventPayloadOf<
  Command extends string,
  Definition,
> = Definition extends EventCommandDefinition
  ? EventCallPayload<Command, DataOf<Definition['data']>>
  : never

export type RequestPayloadOf<
  Command extends string,
  Definition,
> = Definition extends RequestCommandDefinition
  ? RequestCallPayload<'request', Command, DataOf<Definition['params']>>
  : never

export type StreamPayloadOf<
  Command extends string,
  Definition,
> = Definition extends StreamCommandDefinition
  ? RequestCallPayload<'stream', Command, DataOf<Definition['params']>>
  : never

export type ChannelPayloadOf<
  Command extends string,
  Definition,
> = Definition extends ChannelCommandDefinition
  ? RequestCallPayload<'channel', Command, DataOf<Definition['params']>>
  : never

export type SendPayloadOf<Definition> = Definition extends ChannelCommandDefinition
  ? SendCallPayload<DataOf<Definition['send']>>
  : never

export type ClientPayloadOf<
  Command extends string,
  Definition,
> = Definition extends EventCommandDefinition
  ? EventCallPayload<Command, DataOf<Definition['data']>>
  : Definition extends RequestCommandDefinition
    ? RequestCallPayload<'request', Command, DataOf<Definition['params']>> | AbortCallPayload
    : Definition extends StreamCommandDefinition
      ? RequestCallPayload<'stream', Command, DataOf<Definition['params']>> | AbortCallPayload
      : Definition extends ChannelCommandDefinition
        ?
            | RequestCallPayload<'channel', Command, DataOf<Definition['params']>>
            | SendCallPayload<DataOf<Definition['send']>>
            | AbortCallPayload
        : never

export type ClientPayloadRecordsOf<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: ClientPayloadOf<Command, Protocol[Command]>
}

// Server payloads

export type ErrorPayloadOf<Definition> = Definition extends AnyRequestCommandDefinition
  ? ErrorReplyPayloadOf<DataOf<Definition['error']>>
  : never

export type ResultPayloadOf<Definition> = Definition extends AnyRequestCommandDefinition
  ? ResultReplyPayload<DataOf<Definition['result']>>
  : never

export type ReceiveActionPayloadOf<Definition> = Definition extends StreamCommandDefinition
  ? ReceiveReplyPayload<DataOf<Definition['receive']>>
  : Definition extends ChannelCommandDefinition
    ? ReceiveReplyPayload<DataOf<Definition['receive']>>
    : never

export type ServerPayloadOf<Definition> = Definition extends RequestCommandDefinition
  ? ResultReplyPayload<DataOf<Definition['result']>> | ErrorReplyPayloadOf
  : Definition extends StreamCommandDefinition
    ?
        | ReceiveReplyPayload<DataOf<Definition['receive']>>
        | ResultReplyPayload<DataOf<Definition['result']>>
        | ErrorReplyPayloadOf<DataOf<Definition['error']>>
    : Definition extends ChannelCommandDefinition
      ?
          | ReceiveReplyPayload<DataOf<Definition['receive']>>
          | ResultReplyPayload<DataOf<Definition['result']>>
          | ErrorReplyPayloadOf<DataOf<Definition['error']>>
      : never

export type ServerPayloadRecordsOf<Protocol extends ProtocolDefinition> = {
  [Command in keyof Protocol & string]: ServerPayloadOf<Protocol[Command]>
}
