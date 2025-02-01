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
import type { TokenSigner } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

export type StandaloneOptions<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  getRandomID?: () => string
  protocol?: Protocol
  signal?: AbortSignal
  signer?: TokenSigner
}

export function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options: StandaloneOptions<Protocol> = {},
): Client<Protocol> {
  const { access, getRandomID, protocol, signal, signer } = options
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ signal })

  const serverID = signer ? signer.id : undefined
  serve<Protocol>({
    access,
    handlers,
    id: serverID,
    protocol,
    public: serverID == null,
    signal,
    transport: transports.server,
  })
  return new Client<Protocol>({ getRandomID, serverID, signer, transport: transports.client })
}
