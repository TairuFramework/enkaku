import { describe, expect, test } from 'vitest'

import { createMemoryBus } from '../src/bus.js'
import { type BroadcastMessage, createBroadcastTransport } from '../src/transport.js'

function makeMessage(prc: string, data: Record<string, unknown>): BroadcastMessage {
  return { payload: { typ: 'event', prc, data } }
}

describe('createBroadcastTransport', () => {
  test('fans written messages to other transports on the same topic', async () => {
    const bus = createMemoryBus()
    const sender = createBroadcastTransport({ topicID: 'topic-x', bus })
    const receiverA = createBroadcastTransport({ topicID: 'topic-x', bus })
    const receiverB = createBroadcastTransport({ topicID: 'topic-x', bus })

    await sender.write(makeMessage('greet', { hello: 'world' }))

    const a = await receiverA.read()
    const b = await receiverB.read()
    expect(a.value).toEqual(makeMessage('greet', { hello: 'world' }))
    expect(b.value).toEqual(makeMessage('greet', { hello: 'world' }))

    await sender.dispose()
    await receiverA.dispose()
    await receiverB.dispose()
  })

  test('does not deliver across topics', async () => {
    const bus = createMemoryBus()
    const sender = createBroadcastTransport({ topicID: 'topic-x', bus })
    const other = createBroadcastTransport({ topicID: 'topic-y', bus })

    await sender.write(makeMessage('greet', { hello: 'world' }))
    const result = await Promise.race([
      other.read(),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
    ])
    expect(result).toBe('timeout')

    await sender.dispose()
    await other.dispose()
  })

  test('applies wrap on write and unwrap on read (round-trip)', async () => {
    const bus = createMemoryBus()
    // XOR transform proves the bytes pass through wrap/unwrap, not raw JSON.
    const mask = (bytes: Uint8Array) => bytes.map((byte) => byte ^ 0x5a)
    const sender = createBroadcastTransport({ topicID: 't', bus, wrap: mask })
    const receiver = createBroadcastTransport({ topicID: 't', bus, unwrap: mask })

    await sender.write(makeMessage('m', { n: 42 }))
    const got = await receiver.read()
    expect(got.value).toEqual(makeMessage('m', { n: 42 }))

    await sender.dispose()
    await receiver.dispose()
  })
})
