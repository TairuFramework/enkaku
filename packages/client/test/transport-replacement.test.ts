import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports, Transport } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createFailingTransport(): Transport<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
> {
  const readable = new ReadableStream<AnyServerMessageOf<Protocol>>({
    start(controller) {
      controller.error(new Error('read boom'))
    },
  })
  const writable = new WritableStream<AnyClientMessageOf<Protocol>>()
  return new Transport({ stream: { readable, writable } })
}

describe('transport replacement', () => {
  test('disposal of a replaced transport does not abort the client', async () => {
    const failing = createFailingTransport()
    const replacement = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const client = new Client<Protocol>({
      transport: failing,
      handleTransportError: () => replacement.client,
    })

    // Wait for the failing read to trigger replacement
    await new Promise<void>((resolve) => {
      client.events.on('transportReplaced', () => resolve())
    })

    // Now dispose the OLD transport — its stale disposed handler must not
    // abort the client, which is happily using the replacement transport
    await failing.dispose()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(client.signal.aborted).toBe(false)

    await client.dispose()
    await replacement.dispose()
  })
})
