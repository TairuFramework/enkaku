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
import { type AccessRules, type ProcedureHandlers, type ServeParams, serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

type BaseStandaloneOptions<Protocol extends ProtocolDefinition> = {
  getRandomID?: () => string
  protocol?: Protocol
  signal?: AbortSignal
}

export type StandaloneOptions<Protocol extends ProtocolDefinition> =
  | (BaseStandaloneOptions<Protocol> & { identity?: undefined; accessRules?: never })
  | (BaseStandaloneOptions<Protocol> & { identity: Identity; accessRules?: AccessRules })

export function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options: StandaloneOptions<Protocol> = {},
): Client<Protocol> {
  const { getRandomID, protocol, signal, identity } = options
  const accessRules = (options as { accessRules?: AccessRules }).accessRules
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ signal })

  const serverID = identity ? identity.id : undefined
  serve<Protocol>({
    handlers,
    identity,
    protocol,
    signal,
    transport: transports.server,
    ...(accessRules != null ? { accessRules } : {}),
  } as ServeParams<Protocol>)
  return new Client<Protocol>({ getRandomID, serverID, identity, transport: transports.client })
}
