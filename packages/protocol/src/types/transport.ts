import type { SignedPayload, SignedToken, UnsignedToken } from '@enkaku/token'
import type { TransportType } from '@enkaku/transport'

import type { AnyDefinitions } from './definitions.js'
import type { UnknownCallPayload, UnknownReplyPayload } from './invocations.js'
import type { ClientPayloadRecordsOf, ServerPayloadRecordsOf } from './payloads.js'
import type { ValueOf } from './utils.js'

export type Message<Payload extends Record<string, unknown>> =
  | SignedToken<SignedPayload & Payload>
  | UnsignedToken<Payload>

export type ClientMessage<Payload extends UnknownCallPayload = UnknownCallPayload> =
  Message<Payload>

export type ServerMessage<Payload extends UnknownReplyPayload = UnknownReplyPayload> =
  Message<Payload>

export type AnyClientPayloadOf<Definitions extends AnyDefinitions> = ValueOf<
  ClientPayloadRecordsOf<Definitions>
>

export type AnyClientMessageOf<Definitions extends AnyDefinitions> = Message<
  AnyClientPayloadOf<Definitions>
>

export type AnyServerPayloadOf<Definitions extends AnyDefinitions> = ValueOf<
  ServerPayloadRecordsOf<Definitions>
>

export type AnyServerMessageOf<Definitions extends AnyDefinitions> = Message<
  AnyServerPayloadOf<Definitions>
>

export type ClientTransportOf<Definitions extends AnyDefinitions> = TransportType<
  AnyServerMessageOf<Definitions>,
  AnyClientMessageOf<Definitions>
>

export type ServerTransportOf<Definitions extends AnyDefinitions> = TransportType<
  AnyClientMessageOf<Definitions>,
  AnyServerMessageOf<Definitions>
>
