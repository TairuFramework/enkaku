import type { TransportType } from '@enkaku/transport'

import type { AnyActionDefinitions } from './definitions.js'
import type { ClientActionPayloadRecordsOf, ServerActionPayloadRecordsOf } from './payloads.js'
import type { OptionalRecord, ValueOf } from './utils.js'

export type ClientMessage<Action, Meta extends OptionalRecord> = {
  action: Action
  meta: Meta
}

export type ServerMessage<Action> = {
  action: Action
}

export type Envelope<Action, Meta extends OptionalRecord> = {
  enkaku: '0.1'
  message: ClientMessage<Action, Meta> | ServerMessage<Action>
}

export type AnyClientPayloadOf<Definitions> = ValueOf<ClientActionPayloadRecordsOf<Definitions>>

export type AnyClientMessageOf<Definitions, Meta extends OptionalRecord> = ClientMessage<
  AnyClientPayloadOf<Definitions>,
  Meta
>

export type AnyServerPayloadOf<Definitions> = ValueOf<ServerActionPayloadRecordsOf<Definitions>>

export type AnyServerMessageOf<Definitions> = ServerMessage<AnyServerPayloadOf<Definitions>>

export type ClientTransportOf<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
> = TransportType<AnyServerMessageOf<Definitions>, AnyClientMessageOf<Definitions, Meta>>

export type ServerTransportOf<
  Definitions extends AnyActionDefinitions,
  Meta extends OptionalRecord,
> = TransportType<AnyClientMessageOf<Definitions, Meta>, AnyServerMessageOf<Definitions>>
