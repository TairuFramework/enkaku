import type { ProtocolDefinition } from '@enkaku/protocol'
import type { ChannelHandler } from '@enkaku/server'
import { describe, expect, test, vi } from 'vitest'

import { standalone } from '../src/index.js'

describe('channel send with validation enabled', () => {
  test('real client send reaches the handler when the server has a protocol', async () => {
    const protocol = {
      test: {
        type: 'channel',
        param: { type: 'number' },
        send: { type: 'number' },
        receive: { type: 'number' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const received: Array<number> = []
    const handler = vi.fn<ChannelHandler<Protocol, 'test'>>(async (ctx) => {
      const reader = ctx.readable.getReader()
      const { value } = await reader.read()
      if (value != null) {
        received.push(value)
      }
      return 'END'
    })

    // Passing `protocol` makes the server build a validator.
    const client = standalone<Protocol>({ test: handler }, { requireAuth: false, protocol })

    const channel = client.createChannel('test', { param: 5 })
    await channel.send(42)
    await expect(channel).resolves.toBe('END')

    expect(received).toEqual([42])
  })
})
