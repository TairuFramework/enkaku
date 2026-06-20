import { fromUTF } from '@enkaku/codec'
import { describe, expect, test, vi } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { BroadcastClient } from '../src/client.js'
import { createBroadcastResponder, suppressible } from '../src/responder.js'
import { createBroadcastTransport } from '../src/transport.js'

const TOPIC = 'group-topic'

describe('createBroadcastResponder', () => {
  test('answers a request from the client', async () => {
    const bus = createMemoryBus()
    const responder = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: { add: (prm) => (prm as { n: number }).n + 1 },
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const result = await client.request('add', { n: 41 }, { timeoutMs: 1000 })
    expect(result).toBe(42)

    await client.dispose()
    await responder.dispose()
  })

  test('reports a thrown handler error as an error reply', async () => {
    const bus = createMemoryBus()
    const responder = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: {
        boom: () => {
          throw new Error('kaboom')
        },
      },
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    await expect(
      client.request('boom', {}, { errorThreshold: 1, timeoutMs: 1000 }),
    ).rejects.toThrow(/error/i)

    await client.dispose()
    await responder.dispose()
  })

  test('keeps answering valid requests after a malformed inbound message', async () => {
    const bus = createMemoryBus()
    const responder = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: { ping: () => 'pong' },
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    // Inject raw non-JSON bytes directly onto the bus, bypassing the transport's
    // write() guard. This simulates an undecryptable message from another group.
    bus.publish(TOPIC, fromUTF('not-valid-json{{{{'))

    // Let the failing decode settle — the stream must NOT die.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // The responder and client transports should still be functional.
    const result = await client.request('ping', {}, { timeoutMs: 1000 })
    expect(result).toBe('pong')

    await client.dispose()
    await responder.dispose()
  })

  test('suppressible: a slow responder stays silent once it sees another reply', async () => {
    const bus = createMemoryBus()
    // Deterministic jitter: peer-1 replies immediately, peer-2 waits long enough
    // to observe peer-1's reply and suppress itself.
    const fast = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-1',
      handlers: { catchup: suppressible(() => 'answer', { jitterMs: 100 }) },
      getJitterMs: () => 0,
    })
    const slowHandler = vi.fn(() => 'answer')
    const slow = createBroadcastResponder({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
      from: 'peer-2',
      handlers: { catchup: suppressible(slowHandler, { jitterMs: 100 }) },
      getJitterMs: () => 50,
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const result = await client.request('catchup', {}, { timeoutMs: 200 })
    expect(result).toBe('answer')
    expect(slowHandler).not.toHaveBeenCalled()

    await client.dispose()
    await fast.dispose()
    await slow.dispose()
  })
})
