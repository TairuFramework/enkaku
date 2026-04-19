import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import { createHub, createMemoryStore } from '@enkaku/hub-server'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
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

function createTestHub() {
  const store = createMemoryStore()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({
    transport: transports.server,
    store,
    accessControl: false,
  })
  return { hub, store, transports }
}

function createTestClient(
  hub: ReturnType<typeof createTestHub>['hub'],
  identity = randomIdentity(),
) {
  const transports: HubTransports = new DirectTransports()
  hub.server.handle(transports.server)
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
  })
  const client = new HubClient({ client: rawClient })
  return { client, identity, transports }
}

describe('HubClient', () => {
  test('send to explicit recipients and receive', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(hub)

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.send({ recipients: [bobIdentity.id], payload: btoa('hello') })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('hello'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('groupSend and receive with group', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    const channel = bob.receive()
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'chat', payload: btoa('group-hello') })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(btoa('group-hello'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('receive with groupIDs filter', async () => {
    const { hub } = createTestHub()
    const { client: alice, transports: aliceT } = createTestClient(hub)
    const { client: bob, identity: bobIdentity, transports: bobT } = createTestClient(hub)

    await alice.joinGroup('chat')
    await alice.joinGroup('work')
    await bob.joinGroup('chat')
    await bob.joinGroup('work')

    const channel = bob.receive({ groupIDs: ['chat'] })
    const reader = channel.readable.getReader()
    await delay(50)

    await alice.groupSend({ groupID: 'work', payload: btoa('work-msg') })
    await alice.groupSend({ groupID: 'chat', payload: btoa('chat-msg') })
    await alice.send({ recipients: [bobIdentity.id], payload: btoa('direct-msg') })

    await delay(100)
    const msg1 = await reader.read()
    expect(msg1.value?.payload).toBe(btoa('chat-msg'))

    const msg2 = await reader.read()
    expect(msg2.value?.payload).toBe(btoa('direct-msg'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await aliceT.dispose()
    await bobT.dispose()
  })

  test('joinGroup and leaveGroup', async () => {
    const { hub } = createTestHub()
    const { client, transports } = createTestClient(hub)

    const result = await client.joinGroup('test-group')
    expect(result.joined).toBe(true)

    const leaveResult = await client.leaveGroup('test-group')
    expect(leaveResult.left).toBe(true)

    await transports.dispose()
  })

  test('uploadKeyPackages and fetchKeyPackages', async () => {
    const { hub } = createTestHub()
    const { client, identity, transports } = createTestClient(hub)

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
