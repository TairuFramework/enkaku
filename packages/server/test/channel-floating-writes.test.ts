import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { type ChannelHandler, type ProcedureHandlers, serve } from '../src/index.js'

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

describe('channel writer promises are not left floating', () => {
  const rejections: Array<unknown> = []
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

  test('send to a channel whose handler cancelled the readable', async () => {
    const handler: ChannelHandler<Protocol, 'echo'> = (async (ctx) => {
      // Handler stops consuming inbound values immediately
      await ctx.readable.cancel()
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return null
    }) as ChannelHandler<Protocol, 'echo'>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers: { echo: handler } as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })

    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'echo',
        rid: 'c1',
        prm: {},
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Pre-fix: this write rejects on the cancelled pipe → unhandled rejection
    await transports.client.write(
      createUnsignedToken({
        typ: 'send',
        rid: 'c1',
        val: {},
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)

    await server.dispose()
    await transports.dispose()
  })
})
