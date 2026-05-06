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
import { type AccessRules, type ProcedureHandlers, serve } from '@enkaku/server'
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
  const { getRandomID, protocol, signal } = options
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ signal })

  if (options.identity != null) {
    serve<Protocol>({
      handlers,
      identity: options.identity,
      protocol,
      signal,
      transport: transports.server,
      accessRules: options.accessRules,
    })
  } else {
    serve<Protocol>({
      handlers,
      protocol,
      signal,
      transport: transports.server,
    })
  }

  const serverID = options.identity?.id
  return new Client<Protocol>({
    getRandomID,
    serverID,
    identity: options.identity,
    transport: transports.client,
  })
}
