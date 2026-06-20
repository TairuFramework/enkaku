import { describe, expect, test, vi } from 'vitest'

import { createMemoryStore } from '../src/memoryStore.js'

const ALICE = 'did:key:alice'
const BOB = 'did:key:bob'
const CAROL = 'did:key:carol'
const TOPIC = 'topic:1'

describe('createMemoryStore pub/sub', () => {
  test('publish stores nothing when the topic has no subscribers (drop)', async () => {
    const store = createMemoryStore()
    const id = await store.publish({
      senderDID: ALICE,
      topicID: TOPIC,
      payload: new Uint8Array([1]),
    })
    expect(typeof id).toBe('string')
    const result = await store.fetch({ recipientDID: BOB })
    expect(result.messages).toHaveLength(0)
  })

  test('publish fans out to current subscribers (minus sender)', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(ALICE, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1, 2]) })

    const bob = await store.fetch({ recipientDID: BOB })
    expect(bob.messages).toHaveLength(1)
    expect(bob.messages[0].topicID).toBe(TOPIC)
    expect(bob.messages[0].senderDID).toBe(ALICE)
    expect(bob.messages[0].payload).toEqual(new Uint8Array([1, 2]))

    // Sender is excluded from its own publish.
    const alice = await store.fetch({ recipientDID: ALICE })
    expect(alice.messages).toHaveLength(0)
  })

  test('getSubscribers reflects subscribe / unsubscribe', async () => {
    const store = createMemoryStore()
    expect(await store.getSubscribers(TOPIC)).toEqual([])
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(BOB, TOPIC) // idempotent
    expect(await store.getSubscribers(TOPIC)).toEqual([BOB])
    await store.unsubscribe(BOB, TOPIC)
    expect(await store.getSubscribers(TOPIC)).toEqual([])
  })

  test('unsubscribe clears the subscriber pending deliveries for that topic', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(CAROL, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })

    await store.unsubscribe(BOB, TOPIC)
    expect((await store.fetch({ recipientDID: BOB })).messages).toHaveLength(0)
    // Carol still has hers.
    expect((await store.fetch({ recipientDID: CAROL })).messages).toHaveLength(1)
  })

  test('last unsubscribe drops the whole topic log immediately', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    await store.unsubscribe(BOB, TOPIC)
    // Re-subscribe and confirm no backlog survived.
    await store.subscribe(BOB, TOPIC)
    expect((await store.fetch({ recipientDID: BOB })).messages).toHaveLength(0)
  })

  test('maxDepth trims the oldest message per topic on publish', async () => {
    const store = createMemoryStore({ maxDepth: 2 })
    await store.subscribe(BOB, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([2]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([3]) })

    const result = await store.fetch({ recipientDID: BOB })
    expect(result.messages.map((m) => m.payload[0])).toEqual([2, 3])
  })

  test('refcount GC: message removed when its last subscriber acks', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.subscribe(CAROL, TOPIC)
    const id = await store.publish({
      senderDID: ALICE,
      topicID: TOPIC,
      payload: new Uint8Array([1]),
    })
    await store.ack({ recipientDID: BOB, sequenceIDs: [id] })
    expect((await store.fetch({ recipientDID: CAROL })).messages).toHaveLength(1)
    await store.ack({ recipientDID: CAROL, sequenceIDs: [id] })
    expect((await store.fetch({ recipientDID: CAROL })).messages).toHaveLength(0)
  })

  test('fetch respects after cursor, limit, and hasMore', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    const id1 = await store.publish({
      senderDID: ALICE,
      topicID: TOPIC,
      payload: new Uint8Array([1]),
    })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([2]) })
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([3]) })

    const after = await store.fetch({ recipientDID: BOB, after: id1 })
    expect(after.messages.map((m) => m.payload[0])).toEqual([2, 3])

    const limited = await store.fetch({ recipientDID: BOB, limit: 1 })
    expect(limited.messages).toHaveLength(1)
    expect(limited.hasMore).toBe(true)
  })

  test('purge removes aged messages and emits the purge event', async () => {
    const store = createMemoryStore()
    await store.subscribe(BOB, TOPIC)
    await store.publish({ senderDID: ALICE, topicID: TOPIC, payload: new Uint8Array([1]) })
    const handler = vi.fn()
    store.events.on('purge', handler)
    const purged = await store.purge({ olderThan: 0 })
    expect(purged.length).toBeGreaterThan(0)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceIDs: expect.any(Array) }),
    )
    expect((await store.fetch({ recipientDID: BOB })).messages).toHaveLength(0)
  })

  test('key package store and fetch', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage(ALICE, 'kp-1')
    await store.storeKeyPackage(ALICE, 'kp-2')
    expect(await store.fetchKeyPackages(ALICE, 1)).toEqual(['kp-1'])
    expect(await store.fetchKeyPackages(ALICE)).toEqual(['kp-2'])
  })
})
