import { describe, expect, test } from 'vitest'

import { createMemoryStore } from '../src/memoryStore.js'

describe('createMemoryStore', () => {
  test('enqueue and dequeue round-trip', async () => {
    const store = createMemoryStore()
    const msg = {
      senderDID: 'alice',
      groupID: 'g1',
      epoch: 1,
      contentType: 'application' as const,
      payload: 'data',
    }

    await store.enqueue('bob', msg)
    const result = await store.dequeue('bob')
    expect(result).toEqual([msg])
  })

  test('dequeue returns empty array for unknown DID', async () => {
    const store = createMemoryStore()
    const result = await store.dequeue('unknown')
    expect(result).toEqual([])
  })

  test('dequeue with limit returns partial queue and preserves remainder', async () => {
    const store = createMemoryStore()
    for (let i = 0; i < 5; i++) {
      await store.enqueue('bob', {
        senderDID: 'alice',
        groupID: 'g1',
        epoch: i,
        contentType: 'application',
        payload: `msg-${i}`,
      })
    }

    const first = await store.dequeue('bob', 2)
    expect(first).toHaveLength(2)
    expect(first[0]?.payload).toBe('msg-0')
    expect(first[1]?.payload).toBe('msg-1')

    const rest = await store.dequeue('bob')
    expect(rest).toHaveLength(3)
    expect(rest[0]?.payload).toBe('msg-2')
  })

  test('dequeue is destructive — messages are consumed', async () => {
    const store = createMemoryStore()
    await store.enqueue('bob', {
      senderDID: 'alice',
      groupID: 'g1',
      epoch: 1,
      contentType: 'application',
      payload: 'once',
    })

    const first = await store.dequeue('bob')
    expect(first).toHaveLength(1)

    const second = await store.dequeue('bob')
    expect(second).toEqual([])
  })

  test('storeKeyPackage and fetchKeyPackages round-trip', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage('alice', 'kp1')
    await store.storeKeyPackage('alice', 'kp2')
    await store.storeKeyPackage('alice', 'kp3')

    const result = await store.fetchKeyPackages('alice', 2)
    expect(result).toEqual(['kp1', 'kp2'])
  })

  test('fetchKeyPackages consumes packages (single-use)', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage('alice', 'kp1')

    const first = await store.fetchKeyPackages('alice', 1)
    expect(first).toEqual(['kp1'])

    const second = await store.fetchKeyPackages('alice', 1)
    expect(second).toEqual([])
  })

  test('fetchKeyPackages defaults to count=1', async () => {
    const store = createMemoryStore()
    await store.storeKeyPackage('alice', 'kp1')
    await store.storeKeyPackage('alice', 'kp2')

    const result = await store.fetchKeyPackages('alice')
    expect(result).toEqual(['kp1'])
  })

  test('fetchKeyPackages returns empty for unknown DID', async () => {
    const store = createMemoryStore()
    const result = await store.fetchKeyPackages('unknown')
    expect(result).toEqual([])
  })

  test('setGroupMembers and getGroupMembers round-trip', async () => {
    const store = createMemoryStore()
    await store.setGroupMembers('g1', ['alice', 'bob'])
    const members = await store.getGroupMembers('g1')
    expect(members).toEqual(['alice', 'bob'])
  })

  test('getGroupMembers returns empty for unknown group', async () => {
    const store = createMemoryStore()
    const result = await store.getGroupMembers('unknown')
    expect(result).toEqual([])
  })
})
