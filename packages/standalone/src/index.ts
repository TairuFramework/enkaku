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
import { type ProcedureHandlers, type ServerAccessOptions, serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'

export type StandaloneOptions<Protocol extends ProtocolDefinition> = {
  getRandomID?: () => string
  protocol?: Protocol
  signal?: AbortSignal
} & ServerAccessOptions

export function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options: StandaloneOptions<Protocol> = { requireAuth: false },
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
      requireAuth: false,
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
