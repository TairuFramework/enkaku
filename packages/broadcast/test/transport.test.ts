import type { ReadableStreamReadResult } from 'node:stream/web'

import { fromUTF } from '@sozai/codec'
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

  test('dispose() closes the readable so parked reads resolve rather than hang', async () => {
    const bus = createMemoryBus()
    const transport = createBroadcastTransport<BroadcastMessage, BroadcastMessage>({
      topicID: 'topic-dispose',
      bus,
    })

    // Park a read before any message arrives.
    const readPromise = transport.read()

    // Let the microtask queue settle so the read is truly parked.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // dispose() → writer.close() → in the fixed code → readable controller.close()
    await transport.dispose()

    const TIMEOUT = 'timeout' as const
    const result = await Promise.race([
      readPromise,
      new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 500)),
    ])

    // If the readable was never closed, the 500 ms timeout fires first — test failure.
    expect(result).not.toBe(TIMEOUT)
    expect((result as ReadableStreamReadResult<BroadcastMessage>).done).toBe(true)
  })

  test('write() rejects non-event payloads', async () => {
    const bus = createMemoryBus()
    const transport = createBroadcastTransport({ topicID: 'topic-x', bus })

    await expect(
      transport.write({ payload: { typ: 'request', prc: 'x', data: {} } }),
    ).rejects.toThrow(/event/i)

    await transport.dispose()
  })

  test('write() resolves for a normal event payload', async () => {
    const bus = createMemoryBus()
    const transport = createBroadcastTransport({ topicID: 'topic-x', bus })

    // A normal event write resolves without error.
    await expect(transport.write(makeMessage('ok', {}))).resolves.toBeUndefined()

    await transport.dispose()
  })

  test('a per-message decode failure does not kill the stream', async () => {
    const bus = createMemoryBus()
    const receiver = createBroadcastTransport({ topicID: 'topic-x', bus })

    // Inject raw bytes that cannot be decoded as JSON.
    bus.publish('topic-x', fromUTF('this-is-not-valid-json{{{{'))

    // Let the microtask queue settle so the failing decode runs and is discarded.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    // Now publish a well-formed event — the subscription must still be alive.
    const sender = createBroadcastTransport({ topicID: 'topic-x', bus })
    await sender.write(makeMessage('hello', { n: 1 }))

    const TIMEOUT = 'timeout' as const
    const result = await Promise.race([
      receiver.read(),
      new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 500)),
    ])

    // If the readable was killed, the timeout fires and this assertion fails.
    expect(result).not.toBe(TIMEOUT)
    expect((result as ReadableStreamReadResult<BroadcastMessage>).value).toEqual(
      makeMessage('hello', { n: 1 }),
    )

    await sender.dispose()
    await receiver.dispose()
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
