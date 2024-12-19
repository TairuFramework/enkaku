import type {
  AnyRequestProcedureDefinition,
  ChannelProcedureDefinition,
  EventProcedureDefinition,
  ProtocolDefinition,
  RequestProcedureDefinition,
  StreamProcedureDefinition,
} from '../schemas/protocol.js'
import type {
  AbortCallPayload,
  ErrorReplyPayloadOf,
  EventCallPayload,
  ReceiveReplyPayload,
  RequestCallPayload,
  ResultReplyPayload,
  SendCallPayload,
} from './calls.js'
import type { DataOf } from './utils.js'

// Client payloads

export type EventPayloadOf<
  Procedure extends string,
  Definition,
> = Definition extends EventProcedureDefinition
  ? EventCallPayload<Procedure, DataOf<Definition['data']>>
  : never

export type RequestPayloadOf<
  Procedure extends string,
  Definition,
> = Definition extends RequestProcedureDefinition
  ? RequestCallPayload<'request', Procedure, DataOf<Definition['params']>>
  : never

export type StreamPayloadOf<
  Procedure extends string,
  Definition,
> = Definition extends StreamProcedureDefinition
  ? RequestCallPayload<'stream', Procedure, DataOf<Definition['params']>>
  : never

export type ChannelPayloadOf<
  Procedure extends string,
  Definition,
> = Definition extends ChannelProcedureDefinition
  ? RequestCallPayload<'channel', Procedure, DataOf<Definition['params']>>
  : never

export type SendPayloadOf<Definition> = Definition extends ChannelProcedureDefinition
  ? SendCallPayload<DataOf<Definition['send']>>
  : never

export type ClientPayloadOf<
  Procedure extends string,
  Definition,
> = Definition extends EventProcedureDefinition
  ? EventCallPayload<Procedure, DataOf<Definition['data']>>
  : Definition extends RequestProcedureDefinition
    ? RequestCallPayload<'request', Procedure, DataOf<Definition['params']>> | AbortCallPayload
    : Definition extends StreamProcedureDefinition
      ? RequestCallPayload<'stream', Procedure, DataOf<Definition['params']>> | AbortCallPayload
      : Definition extends ChannelProcedureDefinition
        ?
            | RequestCallPayload<'channel', Procedure, DataOf<Definition['params']>>
            | SendCallPayload<DataOf<Definition['send']>>
            | AbortCallPayload
        : never

export type ClientPayloadRecordsOf<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: ClientPayloadOf<Procedure, Protocol[Procedure]>
}

// Server payloads

export type ErrorPayloadOf<Definition> = Definition extends AnyRequestProcedureDefinition
  ? ErrorReplyPayloadOf<DataOf<Definition['error']>>
  : never

export type ResultPayloadOf<Definition> = Definition extends AnyRequestProcedureDefinition
  ? ResultReplyPayload<DataOf<Definition['result']>>
  : never

export type ReceiveActionPayloadOf<Definition> = Definition extends StreamProcedureDefinition
  ? ReceiveReplyPayload<DataOf<Definition['receive']>>
  : Definition extends ChannelProcedureDefinition
    ? ReceiveReplyPayload<DataOf<Definition['receive']>>
    : never

export type ServerPayloadOf<Definition> = Definition extends RequestProcedureDefinition
  ? ResultReplyPayload<DataOf<Definition['result']>> | ErrorReplyPayloadOf
  : Definition extends StreamProcedureDefinition
    ?
        | ReceiveReplyPayload<DataOf<Definition['receive']>>
        | ResultReplyPayload<DataOf<Definition['result']>>
        | ErrorReplyPayloadOf<DataOf<Definition['error']>>
    : Definition extends ChannelProcedureDefinition
      ?
          | ReceiveReplyPayload<DataOf<Definition['receive']>>
          | ResultReplyPayload<DataOf<Definition['result']>>
          | ErrorReplyPayloadOf<DataOf<Definition['error']>>
      : never

export type ServerPayloadRecordsOf<Protocol extends ProtocolDefinition> = {
  [Procedure in keyof Protocol & string]: ServerPayloadOf<Protocol[Procedure]>
}
