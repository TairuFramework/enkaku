import { describe, expect, test, vi } from 'vitest'

import { createMemoryStore } from '../src/memoryStore.js'

describe('createMemoryStore', () => {
  test('store returns a sequence ID', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1, 2, 3]),
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  test('fetch returns stored messages for recipient', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1, 2, 3]),
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].senderDID).toBe('did:key:alice')
    expect(result.messages[0].payload).toEqual(new Uint8Array([1, 2, 3]))
    expect(result.cursor).toBe(result.messages[0].sequenceID)
  })

  test('fetch returns empty for unknown recipient', async () => {
    const store = createMemoryStore()
    const result = await store.fetch({ recipientDID: 'did:key:unknown' })
    expect(result.messages).toHaveLength(0)
    expect(result.cursor).toBeNull()
  })

  test('fetch respects after cursor', async () => {
    const store = createMemoryStore()
    const id1 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([2]),
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob', after: id1 })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].payload).toEqual(new Uint8Array([2]))
  })

  test('fetch respects limit and sets hasMore', async () => {
    const store = createMemoryStore()
    for (let i = 0; i < 5; i++) {
      await store.store({
        senderDID: 'did:key:alice',
        recipients: ['did:key:bob'],
        payload: new Uint8Array([i]),
      })
    }
    const result = await store.fetch({ recipientDID: 'did:key:bob', limit: 2 })
    expect(result.messages).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.messages[0].payload).toEqual(new Uint8Array([0]))
    expect(result.messages[1].payload).toEqual(new Uint8Array([1]))
  })

  test('fetch with ack acknowledges previous messages', async () => {
    const store = createMemoryStore()
    const id1 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([2]),
    })
    // Ack first message while fetching
    await store.fetch({
      recipientDID: 'did:key:bob',
      ack: [id1],
    })
    // Re-fetching after ack should not return acked message
    const result2 = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result2.messages).toHaveLength(1)
    expect(result2.messages[0].payload).toEqual(new Uint8Array([2]))
  })

  test('ack removes delivery record for recipient', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    await store.ack({ recipientDID: 'did:key:bob', sequenceIDs: [id] })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(0)
  })

  test('reference counting: message deleted when all recipients ack', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob', 'did:key:carol'],
      payload: new Uint8Array([1]),
    })
    await store.ack({ recipientDID: 'did:key:bob', sequenceIDs: [id] })
    const carolResult = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(carolResult.messages).toHaveLength(1)
    await store.ack({ recipientDID: 'did:key:carol', sequenceIDs: [id] })
    const carolResult2 = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(carolResult2.messages).toHaveLength(0)
  })

  test('store with groupID preserves it in fetched messages', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
      groupID: 'group-123',
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages[0].groupID).toBe('group-123')
  })

  test('store without groupID has no groupID in fetched messages', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages[0].groupID).toBeUndefined()
  })

  test('purge removes messages older than threshold', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const purged = await store.purge({ olderThan: 0 })
    expect(purged.length).toBeGreaterThan(0)
    const result = await store.fetch({ recipientDID: 'did:key:bob' })
    expect(result.messages).toHaveLength(0)
  })

  test('purge emits purge event', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const handler = vi.fn()
    store.events.on('purge', handler)
    await store.purge({ olderThan: 0 })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ sequenceIDs: expect.any(Array) }),
    )
  })

  test('sequence IDs are monotonically ordered', async () => {
    const store = createMemoryStore()
    const id1 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })
    const id2 = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([2]),
    })
    expect(id1 < id2).toBe(true)
  })

  test('key package store and fetch', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage('did:key:alice', 'kp-1')
    await store.storeKeyPackage('did:key:alice', 'kp-2')
    const packages = await store.fetchKeyPackages('did:key:alice', 1)
    expect(packages).toEqual(['kp-1'])
    const remaining = await store.fetchKeyPackages('did:key:alice')
    expect(remaining).toEqual(['kp-2'])
  })

  test('group members management', async () => {
    const store = createMemoryStore()
    await store.setGroupMembers('group-1', ['did:key:alice', 'did:key:bob'])
    const members = await store.getGroupMembers('group-1')
    expect(members).toEqual(['did:key:alice', 'did:key:bob'])
  })
})
