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
import { type CommandAccessRecord, type CommandHandlers, serve } from '@enkaku/server'
import type { TokenSigner } from '@enkaku/token'
import { createDirectTransports } from '@enkaku/transport'

export type StandaloneOptions = {
  access?: CommandAccessRecord
  getRandomID?: () => string
  signal?: AbortSignal
  signer?: TokenSigner
}

export function standalone<Protocol extends ProtocolDefinition>(
  handlers: CommandHandlers<Protocol>,
  options: StandaloneOptions = {},
): Client<Protocol> {
  const { access, getRandomID, signal, signer } = options
  const transports = createDirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ signal })

  const serverID = signer ? signer.id : undefined
  serve<Protocol>({
    access,
    handlers,
    id: serverID,
    signal,
    public: serverID == null,
    transport: transports.server,
  })
  return new Client<Protocol>({ getRandomID, serverID, signer, transport: transports.client })
}
