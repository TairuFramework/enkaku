import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ChannelHandler, type ProcedureHandlers, serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

const protocol = {
  echo: {
    type: 'channel',
    param: { type: 'object' },
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe("channel.close() settles the call promise with 'Close'", () => {
  test('rejects with Close reason', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handler: ChannelHandler<Protocol, 'echo'> = (async (ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return null
    }) as ChannelHandler<Protocol, 'echo'>
    const server = serve<Protocol>({
      accessControl: false,
      handlers: { echo: handler } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })
    const client = new Client<Protocol>({ transport: transports.client })

    const channel = client.createChannel('echo', { param: {} })
    channel.close()

    await expect(channel).rejects.toEqual('Close')

    await client.dispose()
    await server.dispose()
  })
})
