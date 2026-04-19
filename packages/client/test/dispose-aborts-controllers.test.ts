import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'
import { Client } from '../src/index.js'

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

describe('Client.dispose aborts outstanding controllers', () => {
  test('aborts pending channel when client is disposed without close()', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const channel = client.createChannel('echo', { param: {} })

    let channelSettled = false
    void channel.catch(() => {
      channelSettled = true
    })

    // Drain the server transport so its write queue doesn't strand a rejection.
    transports.server.read().catch(() => {})

    await client.dispose()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(channelSettled).toBe(true)

    await transports.server.dispose()
  })

  test('aborts pending readable when client is disposed without close()', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const channel = client.createChannel('echo', { param: {} })
    // Channel result promise rejects on dispose; swallow so it isn't unhandled.
    void channel.catch(() => {})

    const reader = channel.readable.getReader()
    const readPromise = reader.read()
    let readSettled = false
    void readPromise
      .then(() => {
        readSettled = true
      })
      .catch(() => {
        readSettled = true
      })

    transports.server.read().catch(() => {})

    await client.dispose()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(readSettled).toBe(true)

    await transports.server.dispose()
  })
})
