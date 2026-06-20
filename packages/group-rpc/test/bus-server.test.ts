import {
  BroadcastClient,
  createBroadcastTransport,
  createMemoryBus,
  suppressible,
  type Unwrap,
} from '@enkaku/broadcast'
import { fromUTF, toUTF } from '@enkaku/codec'
import { describe, expect, test, vi } from 'vitest'

import { createGroupBusServer } from '../src/bus-server.js'

const flush = () => new Promise((r) => setTimeout(r, 20))
const TOPIC = 'topic:bus'

function stampWrap(did: string) {
  return (bytes: Uint8Array): Uint8Array => {
    const d = fromUTF(did)
    const out = new Uint8Array(2 + d.length + bytes.length)
    new DataView(out.buffer).setUint16(0, d.length, true)
    out.set(d, 2)
    out.set(bytes, 2 + d.length)
    return out
  }
}
const recoverUnwrap: Unwrap = (bytes) => {
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0, true)
  return { payload: bytes.subarray(2 + len), senderDID: toUTF(bytes.subarray(2, 2 + len)) }
}

function clientOn(bus: ReturnType<typeof createMemoryBus>, did: string) {
  return new BroadcastClient({
    transport: createBroadcastTransport({
      topicID: TOPIC,
      bus,
      wrap: stampWrap(did),
      unwrap: recoverUnwrap,
    }),
  })
}
function serverTransport(bus: ReturnType<typeof createMemoryBus>, did: string) {
  return createBroadcastTransport({
    topicID: TOPIC,
    bus,
    wrap: stampWrap(did),
    unwrap: recoverUnwrap,
  })
}

describe('createGroupBusServer', () => {
  test('routes events to eventHandlers with the sender', async () => {
    const bus = createMemoryBus()
    const seen: Array<{ data: unknown; sender?: string }> = []
    const server = createGroupBusServer({
      transport: serverTransport(bus, 'bob'),
      from: 'bob',
      eventHandlers: {
        'app/changed': (data, senderDID) => void seen.push({ data, sender: senderDID }),
      },
      requestHandlers: {},
    })
    const alice = clientOn(bus, 'did:key:alice')
    await alice.dispatch('app/changed', { v: 1 })
    await flush()
    expect(seen).toEqual([{ data: { v: 1 }, sender: 'did:key:alice' }])
    await server.dispose()
    await alice.dispose()
  })

  test('answers anycast requests, exposing sender to the handler', async () => {
    const bus = createMemoryBus()
    let seenSender: string | undefined
    const server = createGroupBusServer({
      transport: serverTransport(bus, 'bob'),
      from: 'bob',
      eventHandlers: {},
      requestHandlers: {
        'app/echo': (prm, ctx) => {
          seenSender = ctx?.senderDID
          return { echoed: prm }
        },
      },
    })
    const alice = clientOn(bus, 'did:key:alice')
    const result = await alice.request('app/echo', { hello: 1 }, { timeoutMs: 500 })
    expect(result).toEqual({ echoed: { hello: 1 } })
    expect(seenSender).toBe('did:key:alice')
    await server.dispose()
    await alice.dispose()
  })

  test('suppressible handlers collapse a storm', async () => {
    const bus = createMemoryBus()
    const handlerFns = ['b1', 'b2', 'b3'].map((from) => vi.fn(() => ({ from })))
    const servers = handlerFns.map((fn, i) =>
      createGroupBusServer({
        transport: serverTransport(bus, `b${i + 1}`),
        from: `b${i + 1}`,
        eventHandlers: {},
        requestHandlers: {
          'app/census': suppressible(fn, { jitterMs: 5, suppressTtlMs: 1000 }),
        },
        getJitterMs: (max) => max,
      }),
    )
    const alice = clientOn(bus, 'did:key:alice')
    const result = await alice.request('app/census', {}, { timeoutMs: 300 })
    expect((result as { from: string }).from).toMatch(/^b[123]$/)
    const totalCalls = handlerFns.reduce((n, fn) => n + fn.mock.calls.length, 0)
    expect(totalCalls).toBeGreaterThanOrEqual(1)
    expect(totalCalls).toBeLessThan(3)
    for (const s of servers) await s.dispose()
    await alice.dispose()
  })

  test('dispose stops handling', async () => {
    const bus = createMemoryBus()
    const seen: Array<unknown> = []
    const server = createGroupBusServer({
      transport: serverTransport(bus, 'bob'),
      from: 'bob',
      eventHandlers: { 'app/changed': (data) => void seen.push(data) },
      requestHandlers: {},
    })
    await server.dispose()
    const alice = clientOn(bus, 'did:key:alice')
    await alice.dispatch('app/changed', { v: 2 })
    await flush()
    expect(seen).toEqual([])
    await alice.dispose()
  })
})
