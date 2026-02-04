/**
 * Standalone client and server for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/standalone
 * ```
 *
 * @module standalone
 */

import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureAccessRecord, type ProcedureHandlers, serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

export type StandaloneOptions<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  getRandomID?: () => string
  protocol?: Protocol
  signal?: AbortSignal
  identity?: Identity
}

export function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options: StandaloneOptions<Protocol> = {},
): Client<Protocol> {
  const { access, getRandomID, protocol, signal, identity } = options
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ signal })

  const serverID = identity ? identity.id : undefined
  serve<Protocol>({
    access,
    handlers,
    identity,
    protocol,
    public: serverID == null,
    signal,
    transport: transports.server,
  })
  return new Client<Protocol>({ getRandomID, serverID, identity, transport: transports.client })
}
