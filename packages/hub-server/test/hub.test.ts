import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { createHub } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('hub handlers', () => {
  test('hub/send delivers to explicit recipient via channel', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to Bob
    const payload = btoa('hello-bob')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)
    expect(msg.value?.senderDID).toBe(aliceIdentity.id)

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })

  test('hub/group/send fails on unknown group', async () => {
    const store = createMemoryStore()
    const transports: HubTransports = new DirectTransports()
    createHub({ transport: transports.server, store })
    const alice = new Client<HubProtocol>({
      transport: transports.client,
      identity: randomIdentity(),
    })

    await expect(
      alice.request('hub/group/send', {
        param: { groupID: 'nonexistent', payload: btoa('hello') },
      }),
    ).rejects.toThrow()

    await transports.dispose()
  })

  test('hub/group/send fans out to group members', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    // Both join group
    await alice.request('hub/group/join', {
      param: { groupID: 'chat', credential: 'test' },
    })
    await bob.request('hub/group/join', {
      param: { groupID: 'chat', credential: 'test' },
    })

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to group
    await alice.request('hub/group/send', {
      param: { groupID: 'chat', payload: btoa('group-message') },
    })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('group-message'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })

  test('hub/receive delivers queued messages on connect', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()

    // Alice sends to Bob while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('offline-msg') },
    })
    await delay(50)

    // Bob connects and opens receive channel
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('offline-msg'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })

  test('hub/receive ack flow', async () => {
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({ transport: aliceTransports.server, store })
    const aliceIdentity = randomIdentity()
    const alice = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    const bobIdentity = randomIdentity()

    // Send messages while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('msg-1') },
    })
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('msg-2') },
    })
    await delay(50)

    // Bob connects, receives messages
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bob = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg1 = await reader.read()
    const msg2 = await reader.read()

    // Ack both messages
    const ack = [msg1.value?.sequenceID, msg2.value?.sequenceID].filter(
      (id): id is string => id != null,
    )
    await channel.send({ ack })
    await delay(50)

    // Close and reconnect -- should get no old messages
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await bobTransports.dispose()

    const bobTransports2: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports2.server)
    const bob2 = new Client<HubProtocol>({
      transport: bobTransports2.client,
      identity: bobIdentity,
    })

    const channel2 = bob2.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()

    // Send a new message to verify channel works
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: btoa('msg-3') },
    })
    const msg3 = await reader2.read()
    expect(msg3.value?.payload).toBe(btoa('msg-3'))

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await bobTransports2.dispose()
    await aliceTransports.dispose()
  })

  test('key package upload and fetch', async () => {
    const store = createMemoryStore()
    const transports: HubTransports = new DirectTransports()
    createHub({ transport: transports.server, store })
    const identity = randomIdentity()
    const client = new Client<HubProtocol>({
      transport: transports.client,
      identity,
    })

    const result = await client.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp-1', 'kp-2'] },
    })
    expect(result.stored).toBe(2)

    const fetched = await client.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 1 },
    })
    expect(fetched.keyPackages).toHaveLength(1)

    await transports.dispose()
  })

  test('group join and leave', async () => {
    const store = createMemoryStore()
    const transports: HubTransports = new DirectTransports()
    createHub({ transport: transports.server, store })
    const identity = randomIdentity()
    const client = new Client<HubProtocol>({
      transport: transports.client,
      identity,
    })

    const joinResult = await client.request('hub/group/join', {
      param: { groupID: 'test-group', credential: 'test' },
    })
    expect(joinResult.joined).toBe(true)

    const leaveResult = await client.request('hub/group/leave', {
      param: { groupID: 'test-group' },
    })
    expect(leaveResult.left).toBe(true)

    await transports.dispose()
  })
})

describe('Hub teardown produces no unhandled rejections', () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => rejections.push(reason)

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('hub/receive channel teardown (original bug repro)', async () => {
    const { createHub, createMemoryStore } = await import('../src/index.js')
    const { Client } = await import('@enkaku/client')
    const { DirectTransports } = await import('@enkaku/transport')
    const { randomIdentity } = await import('@enkaku/token')

    const store = createMemoryStore()
    const hubTransports = new DirectTransports()
    const hub = createHub({ transport: hubTransports.server, store, accessControl: false })
    const clientTransports = new DirectTransports()
    hub.server.handle(clientTransports.server)
    const client = new Client({
      transport: clientTransports.client,
      identity: randomIdentity(),
    } as never)

    const channel = client.createChannel(
      'hub/receive' as never,
      { param: { groupIDs: ['g1'] } } as never,
    )
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await client.dispose()
    await hub.server.dispose()

    await new Promise((r) => setTimeout(r, 20))
    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
  })
})
