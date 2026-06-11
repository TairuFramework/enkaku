import { Client } from '@enkaku/client'
import { fromUTF, toB64 } from '@enkaku/codec'
import { createGroupCapability, delegateGroupMembership } from '@enkaku/group'
import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { type OwnIdentity, randomIdentity, stringifyToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { createHandlers } from '../src/handlers.js'
import { type CreateHubParams, createHub, type HubInstance } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'
import { HubClientRegistry } from '../src/registry.js'

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

export type TestHubOptions = Omit<CreateHubParams, 'identity' | 'store' | 'transport'> & {
  store?: HubStore
}

type TestConnection = {
  client: Client<HubProtocol>
  identity: OwnIdentity
}

type TestHub = {
  hub: HubInstance
  hubID: string
  store: HubStore
  connect: (identity?: OwnIdentity) => TestConnection
  dispose: () => Promise<void>
}

function createTestHub(options: TestHubOptions = {}): TestHub {
  const { store: providedStore, ...hubOptions } = options
  const store = providedStore ?? createMemoryStore()
  const hubIdentity = randomIdentity()
  const firstTransports: HubTransports = new DirectTransports()
  const allTransports: Array<HubTransports> = [firstTransports]
  const hub = createHub({
    ...hubOptions,
    identity: hubIdentity,
    store,
    transport: firstTransports.server,
  })
  let firstUsed = false

  function connect(identity: OwnIdentity = randomIdentity()): TestConnection {
    let transports: HubTransports
    if (firstUsed) {
      transports = new DirectTransports()
      allTransports.push(transports)
      hub.server.handle(transports.server)
    } else {
      transports = firstTransports
      firstUsed = true
    }
    const client = new Client<HubProtocol>({
      transport: transports.client,
      identity,
      serverID: hubIdentity.id,
    })
    return { client, identity }
  }

  async function dispose(): Promise<void> {
    await hub.server.dispose()
    await Promise.all(allTransports.map((transports) => transports.dispose()))
  }

  return { hub, hubID: hubIdentity.id, store, connect, dispose }
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

describe('hub authentication', () => {
  test('rejects unsigned client messages', async () => {
    const ctx = createTestHub()
    const transports: HubTransports = new DirectTransports()
    ctx.hub.server.handle(transports.server)
    // No identity: the client sends unsigned tokens
    const anonymous = new Client<HubProtocol>({ transport: transports.client })

    await expect(
      anonymous.request('hub/send', {
        param: { recipients: ['did:test:recipient'], payload: encodePayload('nope') },
      }),
    ).rejects.toThrow('Message is not signed')

    await transports.dispose()
    await ctx.dispose()
  })

  test('handlers reject messages without a verified issuer DID', async () => {
    const registry = new HubClientRegistry()
    const store = createMemoryStore()
    const handlers = createHandlers({ registry, store })
    await expect(
      handlers['hub/send']({
        message: { header: {}, payload: { typ: 'request', prc: 'hub/send', rid: '1' } },
        param: { recipients: ['did:test:recipient'], payload: encodePayload('x') },
        signal: new AbortController().signal,
      } as never),
    ).rejects.toThrow('missing verified issuer')
  })
})

describe('hub handlers', () => {
  test('hub/send delivers to explicit recipient via channel', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to Bob
    const payload = encodePayload('hello-bob')
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
    await ctx.dispose()
  })

  test('hub/group/send fails on unknown group', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()

    await expect(
      alice.request('hub/group/send', {
        param: { groupID: 'nonexistent', payload: encodePayload('hello') },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })

  test('hub/group/send fans out to group members', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // Both join group
    const credentialAlice = await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat')
    const credentialBob = await membershipCredential(aliceIdentity, bobIdentity.id, 'chat')
    await alice.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialAlice },
    })
    await bob.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialBob },
    })

    // Bob opens receive channel
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(50)

    // Alice sends to group
    await alice.request('hub/group/send', {
      param: { groupID: 'chat', payload: encodePayload('group-message') },
    })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(encodePayload('group-message'))
    expect(msg.value?.groupID).toBe('chat')

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/group/send from a non-member fails', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const { client: mallory } = ctx.connect()

    // Alice creates and joins the group; Mallory does not join
    const credential = await membershipCredential(aliceIdentity, aliceIdentity.id, 'private')
    await alice.request('hub/group/join', {
      param: { groupID: 'private', credential },
    })

    await expect(
      mallory.request('hub/group/send', {
        param: { groupID: 'private', payload: encodePayload('intrusion') },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })

  test('hub/receive delivers queued messages on connect', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    // Alice sends to Bob while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('offline-msg') },
    })
    await delay(50)

    // Bob connects and opens receive channel
    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(encodePayload('offline-msg'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive ack flow', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    // Send messages while Bob is offline
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-1') },
    })
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-2') },
    })
    await delay(50)

    // Bob connects, receives messages
    const { client: bob } = ctx.connect(bobIdentity)
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

    const { client: bob2 } = ctx.connect(bobIdentity)
    const channel2 = bob2.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()

    // Send a new message to verify channel works
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('msg-3') },
    })
    const msg3 = await reader2.read()
    expect(msg3.value?.payload).toBe(encodePayload('msg-3'))

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('key package upload and fetch', async () => {
    const ctx = createTestHub()
    const { client, identity } = ctx.connect()

    const result = await client.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp-1', 'kp-2'] },
    })
    expect(result.stored).toBe(2)

    const fetched = await client.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 1 },
    })
    expect(fetched.keyPackages).toHaveLength(1)

    await ctx.dispose()
  })

  test('group join and leave', async () => {
    const ctx = createTestHub()
    const { client, identity } = ctx.connect()

    const credential = await membershipCredential(identity, identity.id, 'test-group')
    const joinResult = await client.request('hub/group/join', {
      param: { groupID: 'test-group', credential },
    })
    expect(joinResult.joined).toBe(true)

    const leaveResult = await client.request('hub/group/leave', {
      param: { groupID: 'test-group' },
    })
    expect(leaveResult.left).toBe(true)

    await ctx.dispose()
  })

  test('hub/receive rejects second concurrent open for same DID; first stays alive', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // First receive channel
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    const reader1 = channel1.readable.getReader()
    await delay(50)

    // Second receive channel for same DID -- must reject
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    // Server wraps handler errors as a generic "Handler execution failed"
    // payload (HandlerError.from in packages/server overwrites cause.message).
    // The signal we care about is that channel2 rejects; channel1 staying
    // alive is the substantive correctness check below.
    await expect(channel2).rejects.toThrow()

    // First channel still works: Alice sends, channel1 receives
    const payload = encodePayload('still-alive')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader1.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive: close + immediate reopen on same DID succeeds', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel1.close()
    await expect(channel1).rejects.toEqual('Close')

    // Immediate reopen -- no extra delay. The abort listener in handlers.ts
    // calls clearReceiveWriter synchronously, and `await expect(channel1)
    // .rejects...` yields enough microtasks for it to run before channel2
    // reaches the server.
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = encodePayload('reconnect-ok')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive: close + delayed reopen on same DID succeeds', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(100)

    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = encodePayload('delayed-ok')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader2.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel2.close()
    await expect(channel2).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })
})

describe('hub/group/join credential validation', () => {
  test('join with a valid owner capability succeeds', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const credential = await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat')

    const result = await alice.request('hub/group/join', {
      param: { groupID: 'chat', credential },
    })
    expect(result.joined).toBe(true)
    expect(ctx.hub.registry.getGroupMembers('chat')).toContain(aliceIdentity.id)

    await ctx.dispose()
  })

  test('join with a delegated membership credential succeeds', async () => {
    const ctx = createTestHub()
    const ownerIdentity = randomIdentity()
    const { client: bob, identity: bobIdentity } = ctx.connect()
    const credential = await membershipCredential(ownerIdentity, bobIdentity.id, 'chat')

    const result = await bob.request('hub/group/join', {
      param: { groupID: 'chat', credential },
    })
    expect(result.joined).toBe(true)

    await ctx.dispose()
  })

  test('join without a valid credential fails', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()

    await expect(
      alice.request('hub/group/join', {
        param: { groupID: 'chat', credential: 'not-a-token' },
      }),
    ).rejects.toThrow()
    expect(ctx.hub.registry.getGroupMembers('chat')).not.toContain(aliceIdentity.id)

    await ctx.dispose()
  })

  test('join with a credential for a different group fails', async () => {
    const ctx = createTestHub()
    const { client: alice, identity: aliceIdentity } = ctx.connect()
    const credential = await membershipCredential(aliceIdentity, aliceIdentity.id, 'other-group')

    await expect(
      alice.request('hub/group/join', {
        param: { groupID: 'chat', credential },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })

  test('join with a credential issued to a different DID fails', async () => {
    const ctx = createTestHub()
    const ownerIdentity = randomIdentity()
    const strangerDID = randomIdentity().id
    const { client: alice } = ctx.connect()
    // Credential audience is the stranger, not Alice
    const credential = await membershipCredential(ownerIdentity, strangerDID, 'chat')

    await expect(
      alice.request('hub/group/join', {
        param: { groupID: 'chat', credential },
      }),
    ).rejects.toThrow()

    await ctx.dispose()
  })
})

describe('Hub teardown produces no unhandled rejections', () => {
  const rejections: Array<unknown> = []
  const onRejection = (reason: unknown) => rejections.push(reason)

  beforeEach(() => {
    rejections.length = 0
    process.on('unhandledRejection', onRejection)
  })
  afterEach(() => {
    process.off('unhandledRejection', onRejection)
  })

  test('hub/receive channel teardown (original bug repro)', async () => {
    const ctx = createTestHub()
    const { client } = ctx.connect()

    const channel = client.createChannel('hub/receive', { param: { groupIDs: ['g1'] } })
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await client.dispose()
    await ctx.dispose()

    await new Promise((r) => setTimeout(r, 20))
    expect(
      rejections,
      `unexpected unhandled rejections: ${rejections.map(String).join(', ')}`,
    ).toHaveLength(0)
  })
})
