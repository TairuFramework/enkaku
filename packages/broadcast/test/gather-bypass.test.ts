import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { BroadcastClient } from '../src/client.js'
import { createBroadcastResponder, suppressible } from '../src/responder.js'
import { createBroadcastTransport } from '../src/transport.js'

const TOPIC = 'topic:gb'
const flush = () => new Promise((r) => setTimeout(r, 50))

function responder(bus: ReturnType<typeof createMemoryBus>, from: string) {
  return createBroadcastResponder({
    transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    from,
    handlers: {
      // Suppressible: a plain `request` storm-collapses; a `gather` must NOT.
      census: suppressible(() => ({ from }), { jitterMs: 5, suppressTtlMs: 1000 }),
    },
    getJitterMs: (max) => max,
  })
}

describe('gather bypasses suppression', () => {
  test('gather collects ALL replies even with suppressible handlers', async () => {
    const bus = createMemoryBus()
    const responders = ['b1', 'b2', 'b3'].map((from) => responder(bus, from))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const replies = await client.gather('census', {}, { timeoutMs: 300 })
    const froms = replies.map((r) => (r.value as { from: string }).from).sort()
    expect(froms).toEqual(['b1', 'b2', 'b3'])

    for (const r of responders) await r.dispose()
    await client.dispose()
  })

  test('plain request still resolves to a single responder', async () => {
    const bus = createMemoryBus()
    const responders = ['b1', 'b2', 'b3'].map((from) => responder(bus, from))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const result = await client.request('census', {}, { timeoutMs: 300 })
    expect(['b1', 'b2', 'b3']).toContain((result as { from: string }).from)

    await flush()
    for (const r of responders) await r.dispose()
    await client.dispose()
  })
})
