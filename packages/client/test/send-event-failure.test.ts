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

  test('rid-bearing calls still surface the write failure to the caller', async () => {
    const client = new Client<Protocol>({ transport: createFailingWriteTransport() })

    // This is an integration-level guard, not a discriminator: from the
    // caller's side, a rid-bearing call rejecting here is consistent with
    // either the `sent` promise's own rejection propagating through
    // `createRequest`'s `sent.then(() => controller.result)`, or with
    // `#write`'s `onFailure` aborting the per-rid controller with that same
    // error object -- both paths reject with an identical error, so this
    // assertion cannot tell them apart. The discriminating coverage lives in
    // `packages/client/test/safe-write.test.ts`, which pins directly that
    // `safeWrite` resolves for rid-bearing writes and invokes `onFailure`,
    // and rejects for rid-less ones. This test only guards that the rid-less
    // throw introduced alongside that behavior did not change rid-bearing
    // calls: they must still reject rather than hang.
    await expect(client.request('test/request', { id: 'r1' })).rejects.toThrow('socket exploded')

    await client.dispose()
  })
})
