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
import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { type CommandHandlers, serve } from '@enkaku/server'
import type { TokenSigner } from '@enkaku/token'
import { createDirectTransports } from '@enkaku/transport'

export type StandaloneOptions = {
  getRandomID?: () => string
  signal?: AbortSignal
  signer?: TokenSigner
}

export function standalone<Definitions extends AnyDefinitions>(
  handlers: CommandHandlers<Definitions>,
  options: StandaloneOptions = {},
): Client<Definitions> {
  const { getRandomID, signal, signer } = options
  const transports = createDirectTransports<
    AnyServerMessageOf<Definitions>,
    AnyClientMessageOf<Definitions>
  >({ signal })

  const serverID = signer ? signer.id : undefined
  serve({
    handlers,
    signal,
    transport: transports.server,
    ...(serverID ? { id: serverID } : { insecure: true }),
  })
  return new Client<Definitions>({ getRandomID, serverID, signer, transport: transports.client })
}
