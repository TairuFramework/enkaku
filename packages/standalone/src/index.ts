import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyDefinitions, AnyServerMessageOf } from '@enkaku/protocol'
import { type CommandHandlers, serve } from '@enkaku/server'
import type { TokenSigner } from '@enkaku/token'
import { createDirectTransports } from '@enkaku/transport'

export type StandaloneOptions = {
  signal?: AbortSignal
  signer?: TokenSigner
}

export async function standalone<Definitions extends AnyDefinitions>(
  handlers: CommandHandlers<Definitions>,
  options: StandaloneOptions = {},
): Promise<Client<Definitions>> {
  const { signal, signer } = options
  const transports = createDirectTransports<
    AnyServerMessageOf<Definitions>,
    AnyClientMessageOf<Definitions>
  >({ signal })

  const serverID = signer ? await signer.getIssuer() : undefined
  serve({
    handlers,
    signal,
    transport: transports.server,
    ...(serverID ? { id: serverID } : { insecure: true }),
  })
  return new Client<Definitions>({ serverID, signer, transport: transports.client })
}
