import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { BroadcastClient } from '../src/client.js'
import { type BroadcastMessage, createBroadcastTransport } from '../src/transport.js'

const TOPIC = 'group-topic'

// Minimal responder used only to exercise the client: replies to 'req' events.
function startResponder(
  bus: ReturnType<typeof createMemoryBus>,
  from: string,
  reply: (prm: unknown) => { ok?: unknown; err?: string },
): TransportTypeHandle {
  const transport = createBroadcastTransport({ topicID: TOPIC, bus })
  let running = true
  ;(async () => {
    for await (const msg of transport as AsyncIterable<BroadcastMessage>) {
      if (!running) break
      const data = msg.payload.data as { kind?: string; rid?: string; prm?: unknown } | undefined
      if (msg.payload.typ !== 'event' || data?.kind !== 'req') continue
      const out = reply(data.prm)
      await transport.write({
        payload: {
          typ: 'event',
          prc: msg.payload.prc,
          data: { kind: 'res', rid: data.rid, from, ...out },
        },
      })
    }
  })()
  return {
    dispose: async () => {
      running = false
      await transport.dispose()
    },
  }
}

type TransportTypeHandle = { dispose: () => Promise<void> }

describe('BroadcastClient.request', () => {
  test('resolves with the first non-error reply', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ ok: { value: 'from-1' } }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const result = await client.request('catchup', { since: 0 }, { timeoutMs: 1000 })
    expect(result).toEqual({ value: 'from-1' })

    await client.dispose()
    await r1.dispose()
  })

  test('rejects after errorThreshold error replies', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ err: 'nope' }))
    const r2 = startResponder(bus, 'peer-2', () => ({ err: 'nope' }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    await expect(
      client.request('catchup', {}, { errorThreshold: 2, timeoutMs: 1000 }),
    ).rejects.toThrow(/error/i)

    await client.dispose()
    await r1.dispose()
    await r2.dispose()
  })

  test('rejects on timeout when no reply arrives', async () => {
    const bus = createMemoryBus()
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    await expect(client.request('catchup', {}, { timeoutMs: 50 })).rejects.toThrow(/timed out/i)

    await client.dispose()
  })
})

describe('BroadcastClient.gather', () => {
  test('collects distinct replies up to quorum', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ ok: 1 }))
    const r2 = startResponder(bus, 'peer-2', () => ({ ok: 2 }))
    const r3 = startResponder(bus, 'peer-3', () => ({ ok: 3 }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const replies = await client.gather('census', {}, { quorum: 2, timeoutMs: 1000 })
    expect(replies).toHaveLength(2)
    expect(replies.every((r) => typeof r.from === 'string')).toBe(true)

    await client.dispose()
    await r1.dispose()
    await r2.dispose()
    await r3.dispose()
  })

  test('returns whatever arrived before timeout when quorum not reached', async () => {
    const bus = createMemoryBus()
    const r1 = startResponder(bus, 'peer-1', () => ({ ok: 'a' }))
    const client = new BroadcastClient({
      transport: createBroadcastTransport({ topicID: TOPIC, bus }),
    })

    const replies = await client.gather('census', {}, { quorum: 5, timeoutMs: 100 })
    expect(replies).toEqual([{ from: 'peer-1', value: 'a' }])

    await client.dispose()
    await r1.dispose()
  })
})
