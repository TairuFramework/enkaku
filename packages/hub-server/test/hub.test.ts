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

  test('group roster survives hub restart; re-join does not clobber peers', async () => {
    const store = createMemoryStore()

    // --- first hub lifetime: alice and bob join group 'chat' ---
    const aliceIdentity = randomIdentity()
    const bobIdentity = randomIdentity()
    const hub1 = createTestHub({ store })
    const { client: alice1 } = hub1.connect(aliceIdentity)
    const { client: bob1 } = hub1.connect(bobIdentity)

    const credentialAlice = await membershipCredential(aliceIdentity, aliceIdentity.id, 'chat')
    const credentialBob = await membershipCredential(aliceIdentity, bobIdentity.id, 'chat')
    await alice1.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialAlice },
    })
    await bob1.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialBob },
    })

    expect((await store.getGroupMembers('chat')).sort()).toEqual(
      [aliceIdentity.id, bobIdentity.id].sort(),
    )

    // Tear down the first hub (simulates hub restart)
    await alice1.dispose()
    await bob1.dispose()
    await hub1.dispose()

    // --- restart: fresh registry via a new hub, SAME store; bob stays offline ---
    const hub2 = createTestHub({ store })
    const { client: alice2 } = hub2.connect(aliceIdentity)

    // alice re-joins; her re-join must NOT have removed bob from the durable roster
    await alice2.request('hub/group/join', {
      param: { groupID: 'chat', credential: credentialAlice },
    })

    expect((await store.getGroupMembers('chat')).sort()).toEqual(
      [aliceIdentity.id, bobIdentity.id].sort(),
    )

    // alice sends to group; bob (offline) must have a queued message to fetch on reconnect
    await alice2.request('hub/group/send', {
      param: { groupID: 'chat', payload: encodePayload('after-restart') },
    })
    const queued = await store.fetch({ recipientDID: bobIdentity.id })
    expect(queued.messages.length).toBeGreaterThan(0)

    await alice2.dispose()
    await hub2.dispose()
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

  test('schema validation drops messages violating quotas and emits invalidMessage', async () => {
    const ctx = createTestHub()
    const { client } = ctx.connect()

    const invalidMessage = new Promise<unknown>((resolve) => {
      ctx.hub.server.events.on('invalidMessage', (event) => resolve(event.error))
    })

    // 101 recipients exceeds maxItems: 100
    const recipients = Array.from({ length: 101 }, (_, i) => `did:test:${i}`)
    const request = client.request('hub/send', {
      param: { recipients, payload: encodePayload('too-many') },
    })
    // The server drops invalid messages without replying (error reply for
    // schema-invalid messages ships in the platform-fixes plan), so the
    // request only settles when the client is disposed.
    request.catch(() => {})

    const error = await invalidMessage
    expect(error).toBeInstanceOf(Error)

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

describe('hub/keypackage/fetch limits', () => {
  test('count is capped at maxCount', async () => {
    const ctx = createTestHub({ keyPackageFetchLimits: { maxCount: 3 } })
    const { client, identity } = ctx.connect()

    const keyPackages = Array.from({ length: 10 }, (_, i) => `kp-${i}`)
    await client.request('hub/keypackage/upload', { param: { keyPackages } })

    const fetched = await client.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 10 },
    })
    expect(fetched.keyPackages).toHaveLength(3)

    await ctx.dispose()
  })

  test('fetch requests are rate-limited per requester DID', async () => {
    const ctx = createTestHub({
      keyPackageFetchLimits: { maxRequests: 2, windowMs: 60_000 },
    })
    const { client, identity } = ctx.connect()

    await client.request('hub/keypackage/fetch', { param: { did: identity.id } })
    await client.request('hub/keypackage/fetch', { param: { did: identity.id } })
    await expect(
      client.request('hub/keypackage/fetch', { param: { did: identity.id } }),
    ).rejects.toThrow()

    // A different requester is not affected
    const { client: other } = ctx.connect()
    const result = await other.request('hub/keypackage/fetch', {
      param: { did: identity.id },
    })
    expect(result.keyPackages).toEqual([])

    await ctx.dispose()
  })
})

describe('hub lifecycle', () => {
  test('receive drain failure releases the writer binding (lockout recovery)', async () => {
    const baseStore = createMemoryStore()
    let failNextFetch = true
    const store: HubStore = {
      ...baseStore,
      fetch: async (params) => {
        if (failNextFetch) {
          failNextFetch = false
          throw new Error('store offline')
        }
        return await baseStore.fetch(params)
      },
    }
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    // First open fails during drain (store.fetch throws)
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    await expect(channel1).rejects.toThrow()
    await delay(50)

    // Without cleanup the writer stays bound forever and every reopen fails.
    const channel2 = bob.createChannel('hub/receive', { param: {} })
    const reader2 = channel2.readable.getReader()
    await delay(50)

    const payload = encodePayload('recovered')
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

  test('closing a receive channel unregisters clients with no group memberships', async () => {
    const ctx = createTestHub()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    expect(ctx.hub.registry.getClient(bobIdentity.id)).toBeDefined()

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    expect(ctx.hub.registry.getClient(bobIdentity.id)).toBeUndefined()

    await ctx.dispose()
  })

  test('group members stay registered after their receive channel closes', async () => {
    const ctx = createTestHub()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const credential = await membershipCredential(bobIdentity, bobIdentity.id, 'sticky')
    await bob.request('hub/group/join', {
      param: { groupID: 'sticky', credential },
    })
    const channel = bob.createChannel('hub/receive', { param: {} })
    await delay(50)
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)

    // Offline group members must keep receiving group fan-out via the store
    expect(ctx.hub.registry.getGroupMembers('sticky')).toContain(bobIdentity.id)

    await ctx.dispose()
  })

  test('scheduled purge evicts expired stored messages', async () => {
    const store = createMemoryStore()
    const ctx = createTestHub({ store, purge: { interval: 50, olderThan: 0 } })
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    const purged = new Promise<Array<string>>((resolve) => {
      store.events.on('purge', (event) => resolve(event.sequenceIDs))
    })

    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload: encodePayload('expiring') },
    })

    const sequenceIDs = await purged
    expect(sequenceIDs).toHaveLength(1)
    const result = await store.fetch({ recipientDID: bobIdentity.id })
    expect(result.messages).toHaveLength(0)

    await ctx.dispose()
  })
})

describe('hub server limits', () => {
  test('hub/receive channels outlive controllerTimeoutMs', async () => {
    const ctx = createTestHub({ limits: { controllerTimeoutMs: 100 } })
    const { client: alice } = ctx.connect()
    const { client: bob, identity: bobIdentity } = ctx.connect()

    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    // Wait past the timeout (cleanup interval = min(100, 10000) = 100ms)
    await delay(300)

    const payload = encodePayload('survives-timeout')
    await alice.request('hub/send', {
      param: { recipients: [bobIdentity.id], payload },
    })
    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.payload).toBe(payload)

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(50)
    await ctx.dispose()
  })

  test('hub/receive channels are not bounded by maxConcurrentHandlers', async () => {
    const ctx = createTestHub({ limits: { maxConcurrentHandlers: 2 } })
    const receivers = Array.from({ length: 5 }, () => ctx.connect())
    const channels = receivers.map(({ client }) =>
      client.createChannel('hub/receive', { param: {} }),
    )
    const readers = channels.map((channel) => channel.readable.getReader())
    await delay(100)

    for (const { identity } of receivers) {
      expect(ctx.hub.registry.isOnline(identity.id)).toBe(true)
    }

    // Regular requests still work with all channels held open
    const { client: alice } = ctx.connect()
    const payload = encodePayload('to-first')
    await alice.request('hub/send', {
      param: { recipients: [receivers[0].identity.id], payload },
    })
    const msg = await readers[0].read()
    expect(msg.value?.payload).toBe(payload)

    for (const channel of channels) {
      channel.close()
    }
    await Promise.all(channels.map((channel) => expect(channel).rejects.toEqual('Close')))
    await delay(50)
    await ctx.dispose()
  })

  test('more than 100 receive channels can be open concurrently', { timeout: 30_000 }, async () => {
    const ctx = createTestHub()
    const receivers = Array.from({ length: 105 }, () => ctx.connect())
    const channels = receivers.map(({ client }) =>
      client.createChannel('hub/receive', { param: {} }),
    )
    await delay(500)

    const online = receivers.filter(({ identity }) => ctx.hub.registry.isOnline(identity.id))
    expect(online).toHaveLength(105)

    for (const channel of channels) {
      channel.close()
    }
    await Promise.all(channels.map((channel) => expect(channel).rejects.toEqual('Close')))
    await delay(100)
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
