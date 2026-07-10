import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { ClientTransport } from '../src/index.js'

const protocol = {
  'test/event': { type: 'event' },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('http-fetch event write failures', () => {
  test('rejects the write when the server returns a non-2xx for a rid-less message', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }))
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).rejects.toThrow()

    await transport.dispose()
  })

  test('a failed event does not tear down the transport', async () => {
    let calls = 0
    const fetchFn = vi.fn(async () => {
      calls += 1
      return calls === 1 ? new Response('nope', { status: 500 }) : new Response(null, { status: 204 })
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).rejects.toThrow()

    // The readable was not errored: a second event goes through.
    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).resolves.toBeUndefined()

    await transport.dispose()
  })

  test('a network failure still errors the readable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    await expect(
      transport.write({ payload: { typ: 'event', prc: 'test/event' } } as unknown as AnyClientMessageOf<Protocol>),
    ).rejects.toThrow()

    await expect(transport.read()).rejects.toThrow(/Transport write failed/)

    await transport.dispose()
  })
})
