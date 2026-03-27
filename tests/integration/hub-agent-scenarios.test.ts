import {
  checkDelegationChain,
  createCapability,
  createMemoryRevocationBackend,
  createRevocationChecker,
  createRevocationRecord,
  now,
} from '@enkaku/capability'

import { Client } from '@enkaku/client'
import { HubClient } from '@enkaku/hub-client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import { createHub, createMemoryStore } from '@enkaku/hub-server'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { randomIdentity, stringifyToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createTestHub() {
  const store = createMemoryStore()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({ transport: transports.server, store })
  return { hub, store, transports }
}

function createTestClient(hub: ReturnType<typeof createHub>, identity = randomIdentity()) {
  const transports: HubTransports = new DirectTransports()
  hub.server.handle(transports.server)
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
  })
  const client = new HubClient({ client: rawClient })
  return { client, identity, transports }
}

describe('Scenario A: Multi-device via hub', () => {
  test('two devices, blind relay', async () => {
    const { hub } = createTestHub()
    const { client: phone, transports: phoneT } = createTestClient(hub)
    const { client: laptop, identity: laptopID, transports: laptopT } = createTestClient(hub)

    const channel = laptop.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    const payload = btoa('encrypted-blob')
    await phone.send({ recipients: [laptopID.id], payload })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel.close()
    await delay(50)
    await phoneT.dispose()
    await laptopT.dispose()
  })

  test('store-and-forward: offline device gets messages on connect', async () => {
    const { hub } = createTestHub()
    const laptopIdentity = randomIdentity()
    const { client: phone, transports: phoneT } = createTestClient(hub)

    await phone.send({ recipients: [laptopIdentity.id], payload: btoa('msg-while-offline') })
    await delay(50)

    const { client: laptop, transports: laptopT } = createTestClient(hub, laptopIdentity)
    const channel = laptop.receive()
    const reader = channel.readable.getReader()

    const msg = await reader.read()
    expect(msg.value?.payload).toBe(btoa('msg-while-offline'))

    channel.close()
    await delay(50)
    await phoneT.dispose()
    await laptopT.dispose()
  })

  test('pagination: fetch messages in batches', async () => {
    const { store } = createTestHub()
    const recipient = randomIdentity()

    for (let i = 0; i < 5; i++) {
      await store.store({
        senderDID: 'did:key:sender',
        recipients: [recipient.id],
        payload: new Uint8Array([i]),
      })
    }

    const result1 = await store.fetch({ recipientDID: recipient.id, limit: 2 })
    expect(result1.messages).toHaveLength(2)
    expect(result1.hasMore).toBe(true)

    const result2 = await store.fetch({
      recipientDID: recipient.id,
      after: result1.cursor!,
      limit: 2,
    })
    expect(result2.messages).toHaveLength(2)
    expect(result2.hasMore).toBe(true)

    const result3 = await store.fetch({
      recipientDID: recipient.id,
      after: result2.cursor!,
      limit: 2,
    })
    expect(result3.messages).toHaveLength(1)
  })

  test('ack semantics: unacked messages are re-delivered', async () => {
    const { store } = createTestHub()
    const recipient = randomIdentity()

    await store.store({
      senderDID: 'did:key:sender',
      recipients: [recipient.id],
      payload: new Uint8Array([1]),
    })

    const result1 = await store.fetch({ recipientDID: recipient.id })
    expect(result1.messages).toHaveLength(1)

    const result2 = await store.fetch({ recipientDID: recipient.id })
    expect(result2.messages).toHaveLength(1)

    await store.ack({ recipientDID: recipient.id, sequenceIDs: [result2.messages[0].sequenceID] })

    const result3 = await store.fetch({ recipientDID: recipient.id })
    expect(result3.messages).toHaveLength(0)
  })

  test('combined ack+fetch', async () => {
    const { store } = createTestHub()
    const recipient = randomIdentity()

    const id1 = await store.store({
      senderDID: 'did:key:sender',
      recipients: [recipient.id],
      payload: new Uint8Array([1]),
    })
    await store.store({
      senderDID: 'did:key:sender',
      recipients: [recipient.id],
      payload: new Uint8Array([2]),
    })

    const result = await store.fetch({ recipientDID: recipient.id, ack: [id1] })
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].payload).toEqual(new Uint8Array([2]))
  })
})

describe('Scenario A: Group communication', () => {
  test('group fan-out', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: btoa('hello-group') })

    const msg = await reader.read()
    expect(msg.value?.payload).toBe(btoa('hello-group'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('group send fails on unknown group', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)

    await expect(
      alice.groupSend({ groupID: 'nonexistent', payload: btoa('hello') }),
    ).rejects.toThrow()

    await aliceT.dispose()
  })

  test('receive with groupIDs filter', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobID, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await alice.joinGroup('work')
    await bob.joinGroup('chat')
    await bob.joinGroup('work')

    const channel = bob.receive({ groupIDs: ['chat'] })
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'work', payload: btoa('work-msg') })
    await alice.groupSend({ groupID: 'chat', payload: btoa('chat-msg') })
    await alice.send({ recipients: [bobID.id], payload: btoa('direct-msg') })

    await delay(100)

    const msg1 = await reader.read()
    expect(msg1.value?.payload).toBe(btoa('chat-msg'))

    const msg2 = await reader.read()
    expect(msg2.value?.payload).toBe(btoa('direct-msg'))

    channel.close()
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('mixed delivery: group and direct on same channel', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobID, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: btoa('group-msg') })
    await alice.send({ recipients: [bobID.id], payload: btoa('direct-msg') })

    const msg1 = await reader.read()
    expect(msg1.value?.groupID).toBe('chat')

    const msg2 = await reader.read()
    expect(msg2.value?.groupID).toBeUndefined()

    channel.close()
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })
})

describe('Scenario B: Delegation chain verification', () => {
  test('root delegates to device, third party verifies', async () => {
    const root = randomIdentity()
    const device = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      jti: 'root-to-device',
    })

    const deviceCap = await createCapability(
      device,
      {
        sub: root.id,
        aud: 'did:key:third-party',
        act: 'read',
        res: 'data/*',
      },
      undefined,
      { parentCapability: stringifyToken(delegation) },
    )

    await checkDelegationChain(deviceCap.payload, [stringifyToken(delegation)])
  })

  test('scoped delegation to service', async () => {
    const root = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: 'did:key:service',
      act: 'read',
      res: 'data/*',
      exp: now() + 3600,
      jti: 'root-to-service',
    })

    await checkDelegationChain(delegation.payload, [])
  })

  test('expired delegation rejected', async () => {
    const root = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: 'did:key:device',
      act: '*',
      res: '*',
      exp: now() - 10,
    })

    await expect(checkDelegationChain(delegation.payload, [])).rejects.toThrow('expired')
  })

  test('revocation: revoked capability rejected in chain', async () => {
    const backend = createMemoryRevocationBackend()
    const checker = createRevocationChecker(backend)

    const root = randomIdentity()
    const device = randomIdentity()

    const delegation = await createCapability(root, {
      sub: root.id,
      aud: device.id,
      act: '*',
      res: '*',
      jti: 'revocable-cap',
    })

    const subCap = await createCapability(
      device,
      {
        sub: root.id,
        aud: 'did:key:service',
        act: 'read',
        res: 'data/*',
      },
      undefined,
      { parentCapability: stringifyToken(delegation) },
    )

    await checkDelegationChain(subCap.payload, [stringifyToken(delegation)], {
      verifyToken: checker,
    })

    const record = await createRevocationRecord(root, 'revocable-cap')
    await backend.add(record)

    await expect(
      checkDelegationChain(subCap.payload, [stringifyToken(delegation)], { verifyToken: checker }),
    ).rejects.toThrow('revoked')
  })
})

describe('Store eviction', () => {
  test('consumer-driven purge', async () => {
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

  test('purge event emitted', async () => {
    const store = createMemoryStore()
    await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob'],
      payload: new Uint8Array([1]),
    })

    const eventPromise = store.events.once('purge')
    await store.purge({ olderThan: 0 })
    const event = await eventPromise
    expect(event.sequenceIDs.length).toBeGreaterThan(0)
  })

  test('reference counting: message survives partial ack', async () => {
    const store = createMemoryStore()
    const id = await store.store({
      senderDID: 'did:key:alice',
      recipients: ['did:key:bob', 'did:key:carol'],
      payload: new Uint8Array([1]),
    })

    await store.ack({ recipientDID: 'did:key:bob', sequenceIDs: [id] })

    const result = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(result.messages).toHaveLength(1)

    await store.ack({ recipientDID: 'did:key:carol', sequenceIDs: [id] })
    const result2 = await store.fetch({ recipientDID: 'did:key:carol' })
    expect(result2.messages).toHaveLength(0)
  })
})
