import { Client } from '@enkaku/client'
import type { Signer } from '@enkaku/jwt'
import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { type CommandHandlers, serve } from '@enkaku/server'
import { createDirectTransports } from '@enkaku/transport'

export type StandaloneOptions = {
  signal?: AbortSignal
  signer?: Signer
}

export function standalone<Definitions extends AnyDefinitions>(
  handlers: CommandHandlers<Definitions>,
  options: StandaloneOptions = {},
): Client<Definitions> {
  const { signal, signer } = options
  const transports = createDirectTransports<
    AnyServerMessageOf<Definitions>,
    AnyClientMessageOf<Definitions>
  >({ signal })
  serve({
    handlers,
    signal,
    transport: transports.server,
    ...(signer ? { id: signer.did } : { insecure: true }),
  })
  return new Client<Definitions>({ serverID: signer?.did, signer, transport: transports.client })
}
