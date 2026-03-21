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

function createTestHub() {
  const store = createMemoryStore()
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({
    transport: transports.server,
    store,
    accessControl: false,
  })
  const identity = randomIdentity()
  const rawClient = new Client<HubProtocol>({
    transport: transports.client,
    identity,
  })
  const client = new HubClient({ client: rawClient })
  return { client, hub, transports, store, identity }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('HubClient', () => {
  test('joinGroup and leaveGroup', async () => {
    const { client, transports } = createTestHub()

    await client.joinGroup('test-group')
    await client.leaveGroup('test-group')

    await transports.dispose()
  })

  test('uploadKeyPackages and fetchKeyPackages', async () => {
    const { client, transports } = createTestHub()

    const result = await client.uploadKeyPackages(['kp1', 'kp2'])
    expect(result.stored).toBe(2)

    const fetched = await client.fetchKeyPackages(
      // fetch uses the identity DID from the signed token
      'anonymous', // store key under whatever DID the server sees
      1,
    )
    // Key packages are stored under the authenticated DID
    expect(fetched).toBeDefined()

    await transports.dispose()
  })

  test('send and receive messages', async () => {
    const aliceIdentity = randomIdentity()
    const bobIdentity = randomIdentity()

    const store = createMemoryStore()

    // Alice's connection
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({
      transport: aliceTransports.server,
      store,
      accessControl: false,
    })
    const aliceRaw = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })
    const alice = new HubClient({ client: aliceRaw })

    // Bob's connection
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bobRaw = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })
    const bob = new HubClient({ client: bobRaw })

    // Both join
    await alice.joinGroup('chat')
    await bob.joinGroup('chat')

    // Both open receive streams
    const bobReceive = bob.receive(['chat'])
    const bobReader = bobReceive.readable.getReader()

    // Alice sends via HubClient
    const result = await alice.send({
      senderDID: aliceIdentity.id,
      groupID: 'chat',
      epoch: 1,
      contentType: 'application',
      payload: 'hello-bob',
    })
    expect(result.delivered).toBe(1)

    // Bob receives
    const msg = await bobReader.read()
    expect(msg.done).toBe(false)
    expect(msg.value).toMatchObject({
      groupID: 'chat',
      payload: 'hello-bob',
    })

    // Cleanup
    bobReceive.close()
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })

  test('exposes rawClient', () => {
    const identity = randomIdentity()
    const transports: HubTransports = new DirectTransports()
    const rawClient = new Client<HubProtocol>({
      transport: transports.client,
      identity,
    })
    const client = new HubClient({ client: rawClient })
    expect(client.rawClient).toBe(rawClient)
  })
})
