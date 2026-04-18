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

    // Start waiting for the channel result
    let channelSettled = false
    channel
      .catch(() => {
        channelSettled = true
      })
      .catch(() => {})

    // Drain the server transport to avoid unhandled rejection
    transports.server.read().catch(() => {})

    // Dispose the client without closing the channel
    await client.dispose()

    // Give it a moment to process the abort
    await new Promise((resolve) => setTimeout(resolve, 50))

    // The channel should have been aborted and settled
    expect(channelSettled).toBe(true)
  })

  test('aborts pending readable when client is disposed without close()', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const channel = client.createChannel('echo', { param: {} })
    channel.catch(() => {})
    const reader = channel.readable.getReader()

    // Start a read operation
    const readPromise = reader.read()
    let readSettled = false
    readPromise
      .then(() => {
        readSettled = true
      })
      .catch(() => {
        readSettled = true
      })

    // Drain the server transport to avoid unhandled rejection
    transports.server.read().catch(() => {})

    // Dispose the client without closing the channel
    await client.dispose()

    // Give it a moment to process the abort
    await new Promise((resolve) => setTimeout(resolve, 50))

    // The read should have been aborted and settled
    expect(readSettled).toBe(true)
  })
})
