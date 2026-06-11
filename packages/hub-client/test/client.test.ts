import { Client } from '@enkaku/client'
import { fromUTF, toB64 } from '@enkaku/codec'
import { createGroupCapability, delegateGroupMembership } from '@enkaku/group'
import type { HubProtocol } from '@enkaku/hub-protocol'
import { createHub, createMemoryStore } from '@enkaku/hub-server'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { type OwnIdentity, randomIdentity, stringifyToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { HubClient } from '../src/client.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodePayload(value: string): string {
  return toB64(fromUTF(value))
}

function createTestHub() {
  const store = createMemoryStore()
  const hubIdentity = randomIdentity()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({
    transport: transports.server,
    store,
    identity: hubIdentity,
  })
  return { hub, hubID: hubIdentity.id, store, transports }
}

function createTestClient(testHub: ReturnType<typeof createTestHub>, identity = randomIdentity()) {
  const transports: HubTransports = new DirectTransports()
  testHub.hub.server.handle(transports.server)
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
    serverID: testHub.hubID,
  })
  const client = new HubClient({ client: rawClient })
  return { client, identity, transports }
}

async function membershipCredential(
  owner: OwnIdentity,
  memberDID: string,
  groupID: string,
): Promise<string> {
  if (owner.id === memberDID) {
    return stringifyToken(await createGroupCapability(owner, groupID))
  }
  return stringifyToken(
    await delegateGroupMembership({
      identity: owner,
      groupID,
      recipientDID: memberDID,
      permission: 'member',
    }),
  )
}

describe('HubClient', () => {
  test('send to explicit recipients and receive', async () => {
    const testHub = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(testHub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(testHub)

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.send({ recipients: [bobIdentity.id], payload: encodePayload('hello') })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(encodePayload('hello'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('groupSend and receive with group', async () => {
    const testHub = createTestHub()
    const { client: alice, identity: aliceIdentity, transports: aliceT } = createTestClient(testHub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(testHub)

    await alice.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat'),
    })
    await bob.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, bobIdentity.id, 'chat'),
    })

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: encodePayload('group-hello') })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(encodePayload('group-hello'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('receive with groupIDs filter', async () => {
    const testHub = createTestHub()
    const { client: alice, identity: aliceIdentity, transports: aliceT } = createTestClient(testHub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(testHub)

    await alice.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat'),
    })
    await alice.joinGroup({
      groupID: 'work',
      credential: await membershipCredential(aliceIdentity, aliceIdentity.id, 'work'),
    })
    await bob.joinGroup({
      groupID: 'chat',
      credential: await membershipCredential(aliceIdentity, bobIdentity.id, 'chat'),
    })
    await bob.joinGroup({
      groupID: 'work',
      credential: await membershipCredential(aliceIdentity, bobIdentity.id, 'work'),
    })

    const channel = bob.receive({ groupIDs: ['chat'] })
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'work', payload: encodePayload('work-msg') })
    await alice.groupSend({ groupID: 'chat', payload: encodePayload('chat-msg') })
    await alice.send({ recipients: [bobIdentity.id], payload: encodePayload('direct-msg') })

    await delay(100)
    const msg1 = await reader.read()
    expect(msg1.value?.payload).toBe(encodePayload('chat-msg'))

    const msg2 = await reader.read()
    expect(msg2.value?.payload).toBe(encodePayload('direct-msg'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('joinGroup and leaveGroup', async () => {
    const testHub = createTestHub()
    const { client, identity, transports } = createTestClient(testHub)

    const result = await client.joinGroup({
      groupID: 'test-group',
      credential: await membershipCredential(identity, identity.id, 'test-group'),
    })
    expect(result.joined).toBe(true)

    const leaveResult = await client.leaveGroup('test-group')
    expect(leaveResult.left).toBe(true)

    await transports.dispose()
  })

  test('uploadKeyPackages and fetchKeyPackages', async () => {
    const testHub = createTestHub()
    const { client, identity, transports } = createTestClient(testHub)

    const result = await client.uploadKeyPackages(['kp-1', 'kp-2'])
    expect(result.stored).toBe(2)

    const fetched = await client.fetchKeyPackages(identity.id, 1)
    expect(fetched.keyPackages).toHaveLength(1)

    await transports.dispose()
  })

  test('exposes rawClient', () => {
    const transports: HubTransports = new DirectTransports()
    const rawClient = new Client<HubProtocol>({
      transport: transports.client,
    })
    const client = new HubClient({ client: rawClient })
    expect(client.rawClient).toBe(rawClient)
  })
})
