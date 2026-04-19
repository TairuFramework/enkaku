import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ChannelHandler, type ProcedureHandlers, serve } from '@enkaku/server'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const protocol = {
  echo: {
    type: 'channel',
    param: { type: 'object', properties: {} },
    send: { type: 'object', properties: {} },
    receive: { type: 'object', properties: {} },
    result: { type: 'null' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('teardown produces no unhandled rejections', () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => {
    rejections.push(reason)
  }

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })

  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('channel close followed by disposal', async () => {
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

    // Allow any queued microtasks to flush
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
  })
})
