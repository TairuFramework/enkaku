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

    const replies = await client.gather('catchup', {}, { timeoutMs: 200 })
    expect(replies).toEqual([{ from: 'peer-1', value: 'answer' }])
    expect(slowHandler).not.toHaveBeenCalled()

    await client.dispose()
    await fast.dispose()
    await slow.dispose()
  })
})
