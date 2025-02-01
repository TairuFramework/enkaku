import type { SignedPayload, SignedToken, UnsignedToken } from '@enkaku/token'
import type { TransportType } from '@enkaku/transport'

import type { ProtocolDefinition } from '../schemas/protocol.js'
import type { UnknownCallPayload, UnknownReplyPayload } from './calls.js'
import type { ClientPayloadRecordsOf, ServerPayloadRecordsOf } from './payloads.js'
import type { ValueOf } from './utils.js'

export type Message<Payload extends Record<string, unknown>> =
  | SignedToken<SignedPayload & Payload>
  | UnsignedToken<Payload>

export type ClientMessage<Payload extends UnknownCallPayload = UnknownCallPayload> =
  Message<Payload>

export type ServerMessage<Payload extends UnknownReplyPayload = UnknownReplyPayload> =
  Message<Payload>

export type AnyClientPayloadOf<Protocol extends ProtocolDefinition> = ValueOf<
  ClientPayloadRecordsOf<Protocol>
>

export type AnyClientMessageOf<Protocol extends ProtocolDefinition> = Message<
  AnyClientPayloadOf<Protocol>
>

export type AnyServerPayloadOf<Protocol extends ProtocolDefinition> = ValueOf<
  ServerPayloadRecordsOf<Protocol>
>

export type AnyServerMessageOf<Protocol extends ProtocolDefinition> = Message<
  AnyServerPayloadOf<Protocol>
>

export type ClientTransportOf<Protocol extends ProtocolDefinition> = TransportType<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
>

export type ServerTransportOf<Protocol extends ProtocolDefinition> = TransportType<
  AnyClientMessageOf<Protocol>,
  AnyServerMessageOf<Protocol>
>

export type TransportPingPayload = { type: 'ping'; id?: string }
export type TransportPongPayload = { type: 'pong'; id?: string }

export type TransportMessageHeader = { src: 'transport' }
export type TransportMessagePayload = TransportPingPayload | TransportPongPayload

export type TransportMessage =
  | SignedToken<SignedPayload & TransportMessagePayload, TransportMessageHeader>
  | UnsignedToken<TransportMessagePayload, TransportMessageHeader>
