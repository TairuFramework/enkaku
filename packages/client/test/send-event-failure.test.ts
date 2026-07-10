import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { Transport } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/event': { type: 'event' },
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

/** A transport whose every write fails with a non-benign error. */
function createFailingWriteTransport(): Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>()
  const writable = new WritableStream<AnyClientMessageOf<Protocol>>({
    write() {
      throw new Error('socket exploded')
    },
  })
  return new Transport({ stream: { readable, writable } })
}

describe('sendEvent write failures', () => {
  test('rejects when the transport write fails', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })

    await expect(client.sendEvent('test/event')).rejects.toThrow('socket exploded')

    await client.dispose()
  })

  test('still emits writeFailed alongside the rejection', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })
    const failed = vi.fn()
    client.events.on('writeFailed', failed)

    await expect(client.sendEvent('test/event')).rejects.toThrow('socket exploded')
    expect(failed).toHaveBeenCalled()

    await client.dispose()
  })

  test('rid-bearing writes still resolve and surface on the controller', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })

    // The request call rejects via its controller, not via a safeWrite throw.
    await expect(client.request('test/request', { id: 'r1' })).rejects.toBeDefined()

    await client.dispose()
  })
})
