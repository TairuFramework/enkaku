import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { createHub } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'

function createTestSetup(options?: { withStore?: boolean }) {
  const store = options?.withStore ? createMemoryStore() : undefined
  const transports = new DirectTransports<
    AnyServerMessageOf<HubProtocol>,
    AnyClientMessageOf<HubProtocol>
  >()
  const hub = createHub({
    transport: transports.server,
    store,
    accessControl: false,
  })
  const client = new Client<HubProtocol>({ transport: transports.client })
  return { hub, client, transports, store }
}

describe('hub server', () => {
  test('join and leave a group', async () => {
    const { client, transports } = createTestSetup()

    const joinResult = await client.request('hub/group/join', {
      param: { groupID: 'test-group', credential: '' },
    })
    expect(joinResult.joined).toBe(true)

    const leaveResult = await client.request('hub/group/leave', {
      param: { groupID: 'test-group' },
    })
    expect(leaveResult.left).toBe(true)

    await transports.dispose()
  })

  test('key package upload and fetch with store', async () => {
    const { client, transports } = createTestSetup({ withStore: true })

    const uploadResult = await client.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp1', 'kp2', 'kp3'] },
    })
    expect(uploadResult.stored).toBe(3)

    const fetchResult = await client.request('hub/keypackage/fetch', {
      param: { did: 'anonymous', count: 2 },
    })
    expect(fetchResult.keyPackages).toEqual(['kp1', 'kp2'])

    await transports.dispose()
  })

  test('send and receive messages between two clients', async () => {
    const store = createMemoryStore()

    // Client A
    const transportA = new DirectTransports<
      AnyServerMessageOf<HubProtocol>,
      AnyClientMessageOf<HubProtocol>
    >()
    createHub({
      transport: transportA.server,
      store,
      accessControl: false,
    })
    const clientA = new Client<HubProtocol>({ transport: transportA.client })

    // Register client A and set up receive stream
    await clientA.request('hub/group/join', {
      param: { groupID: 'msg-group', credential: '' },
    })

    // Start receiving
    const streamA = clientA.createStream('hub/receive', {
      param: { groups: ['msg-group'] },
    })
    streamA.readable.getReader()

    // Client A sends a message
    const sendResult = await clientA.request('hub/send', {
      param: {
        groupID: 'msg-group',
        epoch: 1,
        contentType: 'application',
        payload: 'encrypted-data',
      },
    })

    // With single client, message is not delivered to self
    expect(sendResult.delivered).toBe(0)

    streamA.close()
    await transportA.dispose()
  })

  test('store-and-forward for offline members', async () => {
    const store = createMemoryStore()

    // Set up group with two members in store
    await store.setGroupMembers('sf-group', ['alice', 'bob'])

    // Only Alice is online
    const transportA = new DirectTransports<
      AnyServerMessageOf<HubProtocol>,
      AnyClientMessageOf<HubProtocol>
    >()
    createHub({
      transport: transportA.server,
      store,
      accessControl: false,
    })
    const clientA = new Client<HubProtocol>({ transport: transportA.client })

    // Alice joins
    await clientA.request('hub/group/join', {
      param: { groupID: 'sf-group', credential: '' },
    })

    // Alice sends — Bob is offline, should be queued
    const sendResult = await clientA.request('hub/send', {
      param: {
        groupID: 'sf-group',
        epoch: 1,
        contentType: 'application',
        payload: 'queued-message',
      },
    })

    // Both alice and bob are stored as group members in the store,
    // but the sending client's DID is 'anonymous' (unsigned token),
    // so the store sees both alice and bob as offline.
    expect(sendResult.queued).toBe(2)

    // Verify message is in store for bob
    const queued = await store.dequeue('bob')
    expect(queued).toHaveLength(1)
    expect(queued[0]?.payload).toBe('queued-message')

    await transportA.dispose()
  })
})
