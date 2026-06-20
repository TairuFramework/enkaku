import { fromUTF, toUTF } from '@enkaku/codec'
import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { BroadcastClient } from '../src/client.js'
import { createBroadcastResponder } from '../src/responder.js'
import { type BroadcastMessage, createBroadcastTransport, type Unwrap } from '../src/transport.js'

const TOPIC = 'topic:sender'

// Toy "MLS": wrap frames [didLen][did][payload]; unwrap recovers both. Models a
// sender authenticated from inside the ciphertext. Every member uses it, so all
// messages (requests AND replies) are framed.
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

describe('broadcast sender surfacing', () => {
  test('transport attaches senderDID recovered by unwrap', async () => {
    const bus = createMemoryBus()
    const rx = createBroadcastTransport({ topicID: TOPIC, unwrap: recoverUnwrap, bus })
    const reader = rx[Symbol.asyncIterator]()
    const tx = createBroadcastTransport({ topicID: TOPIC, wrap: stampWrap('did:key:alice'), bus })

    await tx.write({ payload: { typ: 'event', prc: 'x', data: { n: 1 } } })
    const { value } = await reader.next()
    const msg = value as BroadcastMessage
    expect(msg.payload.data).toEqual({ n: 1 })
    expect(msg.senderDID).toBe('did:key:alice')

    await rx.dispose()
    await tx.dispose()
  })

  test('default unwrap leaves senderDID undefined', async () => {
    const bus = createMemoryBus()
    const rx = createBroadcastTransport({ topicID: TOPIC, bus })
    const reader = rx[Symbol.asyncIterator]()
    const tx = createBroadcastTransport({ topicID: TOPIC, bus })

    await tx.write({ payload: { typ: 'event', prc: 'x', data: { n: 2 } } })
    const { value } = await reader.next()
    const msg = value as BroadcastMessage
    expect(msg.payload.data).toEqual({ n: 2 })
    expect(msg.senderDID).toBeUndefined()

    await rx.dispose()
    await tx.dispose()
  })

  test('responder passes senderDID to the handler context', async () => {
    const bus = createMemoryBus()
    let seenSender: string | undefined
    const responder = createBroadcastResponder({
      transport: createBroadcastTransport({
        topicID: TOPIC,
        wrap: stampWrap('did:key:bob'),
        unwrap: recoverUnwrap,
        bus,
      }),
      from: 'bob',
      handlers: {
        ask: (_prm, context) => {
          seenSender = context?.senderDID
          return { ok: true }
        },
      },
    })
    const client = new BroadcastClient({
      transport: createBroadcastTransport({
        topicID: TOPIC,
        wrap: stampWrap('did:key:alice'),
        unwrap: recoverUnwrap,
        bus,
      }),
    })

    const result = await client.request('ask', {}, { timeoutMs: 500 })
    expect(result).toEqual({ ok: true })
    expect(seenSender).toBe('did:key:alice')

    await responder.dispose()
    await client.dispose()
  })
})
