import type { Token } from '@enkaku/jwt'
import type { TransportType } from '@enkaku/transport'

import type { AnyDefinitions } from './definitions.js'
import type { UnknownCallPayload, UnknownReplyPayload } from './invocations.js'
import type { ClientPayloadRecordsOf, ServerPayloadRecordsOf } from './payloads.js'
import type { ValueOf } from './utils.js'

export type ClientMessage<Payload extends UnknownCallPayload = UnknownCallPayload> = Token<Payload>

export type ServerMessage<Payload extends UnknownReplyPayload = UnknownReplyPayload> =
  Token<Payload>

export type AnyClientPayloadOf<Definitions> = ValueOf<ClientPayloadRecordsOf<Definitions>>

export type AnyClientMessageOf<Definitions> = Token<AnyClientPayloadOf<Definitions>>

export type AnyServerPayloadOf<Definitions> = ValueOf<ServerPayloadRecordsOf<Definitions>>

export type AnyServerMessageOf<Definitions> = Token<AnyServerPayloadOf<Definitions>>

export type ClientTransportOf<Definitions extends AnyDefinitions> = TransportType<
  AnyServerMessageOf<Definitions>,
  AnyClientMessageOf<Definitions>
>

export type ServerTransportOf<Definitions extends AnyDefinitions> = TransportType<
  AnyClientMessageOf<Definitions>,
  AnyServerMessageOf<Definitions>
>
