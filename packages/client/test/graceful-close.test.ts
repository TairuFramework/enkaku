import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports, Transport } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

/** A transport whose readable closes cleanly on the next microtask. */
function createClosingTransport(): Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>({
    start(controller) {
      controller.close()
    },
  })
  const writable = new WritableStream<AnyClientMessageOf<Protocol>>()
  return new Transport({ stream: { readable, writable } })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out — graceful close was not handled')), ms),
    ),
  ])
}

describe('graceful remote close', () => {
  test('calls handleTransportDisposed when the readable ends', async () => {
    const disposed = vi.fn(() => undefined)
    const client = new Client<Protocol>({
      transport: createClosingTransport(),
      handleTransportDisposed: disposed,
    })

    await withTimeout(
      new Promise<void>((resolve) => {
        client.events.on('disposed', () => resolve())
      }),
      1000,
    )

    expect(disposed).toHaveBeenCalled()
    expect(client.signal.aborted).toBe(true)
  })

  test('aborts in-flight requests instead of hanging them', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const call = client.request('test/request', { id: 'r1' })
    await transports.server.read()

    // Server closes its writable — the client's readable ends cleanly.
    await transports.server.dispose()

    await expect(withTimeout(call, 1000)).rejects.toBeDefined()

    await client.dispose()
    await transports.dispose()
  })

  test('swaps in the replacement transport returned by the handler', async () => {
    const replacement = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({
      transport: createClosingTransport(),
      handleTransportDisposed: () => replacement.client,
    })

    await withTimeout(
      new Promise<void>((resolve) => {
        client.events.on('transportReplaced', () => resolve())
      }),
      1000,
    )

    expect(client.signal.aborted).toBe(false)

    await client.dispose()
    await replacement.dispose()
  })
})
