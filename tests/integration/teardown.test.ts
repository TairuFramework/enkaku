import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ChannelHandler, type ProcedureHandlers, serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const protocol = {
  chat: {
    type: 'channel',
    param: { type: 'object' },
    send: { type: 'object' },
    receive: { type: 'object' },
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('teardown (integration)', () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => rejections.push(reason)

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('close then client dispose then server dispose', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handler: ChannelHandler<Protocol, 'chat'> = (async (ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return null
    }) as ChannelHandler<Protocol, 'chat'>
    const server = serve<Protocol>({
      accessControl: false,
      handlers: { chat: handler } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })
    const client = new Client<Protocol>({ transport: transports.client })
    const channel = client.createChannel('chat', { param: {} })

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await client.dispose()
    await server.dispose()
    await new Promise((r) => setTimeout(r, 20))

    expect(rejections).toHaveLength(0)
  })
})
