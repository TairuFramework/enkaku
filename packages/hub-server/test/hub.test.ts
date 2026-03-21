import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { createHub } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

function createTestSetup(options?: { withStore?: boolean }) {
  const store = options?.withStore ? createMemoryStore() : undefined
  const transports: HubTransports = new DirectTransports()
  const hub = createHub({
    transport: transports.server,
    store,
    accessControl: false,
  })
  const client = new Client<HubProtocol>({ transport: transports.client })
  return { hub, client, transports, store }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  test('keypackage/upload throws without store', async () => {
    const { client, transports } = createTestSetup({ withStore: false })

    await expect(
      client.request('hub/keypackage/upload', {
        param: { keyPackages: ['kp1'] },
      }),
    ).rejects.toThrow()

    await transports.dispose()
  })

  test('two clients send and receive through one hub', async () => {
    const aliceIdentity = randomIdentity()
    const bobIdentity = randomIdentity()

    // Create hub with first transport (Alice)
    const store = createMemoryStore()
    const aliceTransports: HubTransports = new DirectTransports()
    const hub = createHub({
      transport: aliceTransports.server,
      store,
      accessControl: false,
    })
    const aliceClient = new Client<HubProtocol>({
      transport: aliceTransports.client,
      identity: aliceIdentity,
    })

    // Add second transport (Bob)
    const bobTransports: HubTransports = new DirectTransports()
    hub.server.handle(bobTransports.server)
    const bobClient = new Client<HubProtocol>({
      transport: bobTransports.client,
      identity: bobIdentity,
    })

    // Both join the same group
    await aliceClient.request('hub/group/join', {
      param: { groupID: 'chat', credential: '' },
    })
    await bobClient.request('hub/group/join', {
      param: { groupID: 'chat', credential: '' },
    })

    // Both open receive streams
    const aliceStream = aliceClient.createStream('hub/receive', {
      param: { groups: ['chat'] },
    })
    const aliceReader = aliceStream.readable.getReader()

    const bobStream = bobClient.createStream('hub/receive', {
      param: { groups: ['chat'] },
    })
    const bobReader = bobStream.readable.getReader()

    // Alice sends a message
    const sendResult = await aliceClient.request('hub/send', {
      param: {
        groupID: 'chat',
        epoch: 1,
        contentType: 'application',
        payload: 'hello-from-alice',
      },
    })
    // Delivered to Bob (Alice doesn't get her own message)
    expect(sendResult.delivered).toBe(1)

    // Bob receives the message
    const bobMsg = await bobReader.read()
    expect(bobMsg.done).toBe(false)
    expect(bobMsg.value).toMatchObject({
      groupID: 'chat',
      payload: 'hello-from-alice',
      contentType: 'application',
    })

    // Bob sends a reply
    await bobClient.request('hub/send', {
      param: {
        groupID: 'chat',
        epoch: 1,
        contentType: 'application',
        payload: 'hello-from-bob',
      },
    })

    // Alice receives the reply
    const aliceMsg = await aliceReader.read()
    expect(aliceMsg.done).toBe(false)
    expect(aliceMsg.value).toMatchObject({
      groupID: 'chat',
      payload: 'hello-from-bob',
    })

    // Cleanup
    aliceStream.close()
    bobStream.close()
    await delay(50)
    await bobTransports.dispose()
    await aliceTransports.dispose()
  })

  test('store-and-forward: offline member receives on connect', async () => {
    const store = createMemoryStore()
    await store.setGroupMembers('sf-group', ['alice', 'bob'])

    // Alice connects to hub
    const aliceTransports: HubTransports = new DirectTransports()
    createHub({
      transport: aliceTransports.server,
      store,
      accessControl: false,
    })
    const aliceClient = new Client<HubProtocol>({ transport: aliceTransports.client })

    // Alice joins and registers as online
    await aliceClient.request('hub/group/join', {
      param: { groupID: 'sf-group', credential: '' },
    })

    // Alice sends while Bob is offline
    await aliceClient.request('hub/send', {
      param: {
        groupID: 'sf-group',
        epoch: 1,
        contentType: 'application',
        payload: 'queued-for-bob',
      },
    })

    // Verify message is queued for bob
    const queuedBefore = await store.dequeue('bob')
    expect(queuedBefore).toHaveLength(1)
    expect(queuedBefore[0]?.payload).toBe('queued-for-bob')

    await aliceTransports.dispose()
  })
})
