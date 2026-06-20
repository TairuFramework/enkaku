import { Client } from '@enkaku/client'
import { fromUTF, toB64 } from '@enkaku/codec'
import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { AnyClientMessageOf, AnyServerMessageOf } from '@enkaku/protocol'
import { type OwnIdentity, randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { createHandlers } from '../src/handlers.js'
import { type CreateHubParams, createHub, type HubInstance } from '../src/hub.js'
import { createMemoryStore } from '../src/memoryStore.js'
import { HubClientRegistry } from '../src/registry.js'

type HubTransports = DirectTransports<
  AnyServerMessageOf<HubProtocol>,
  AnyClientMessageOf<HubProtocol>
>

const TOPIC = 'topic:1'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function encodePayload(value: string): string {
  return toB64(fromUTF(value))
}

type TestHubOptions = Omit<CreateHubParams, 'identity' | 'store' | 'transport'> & {
  store?: HubStore
}

type TestConnection = {
  client: Client<HubProtocol>
  identity: OwnIdentity
}

type TestHub = {
  hub: HubInstance
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

  return { hub, store, connect, dispose }
}

describe('hub authentication', () => {
  test('rejects unsigned client messages', async () => {
    const ctx = createTestHub()
    const transports: HubTransports = new DirectTransports()
    ctx.hub.server.handle(transports.server)
    const anonymous = new Client<HubProtocol>({ transport: transports.client })

    await expect(
      anonymous.request('hub/publish', {
        param: { topicID: TOPIC, payload: encodePayload('nope') },
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
      handlers['hub/publish']({
        message: { header: {}, payload: { typ: 'request', prc: 'hub/publish', rid: '1' } },
        param: { topicID: TOPIC, payload: encodePayload('x') },
        signal: new AbortController().signal,
      } as never),
    ).rejects.toThrow('missing verified issuer DID')
  })
})

describe('hub pub/sub', () => {
  test('publish fans out to subscribers (live)', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()
    const { client: bob } = ctx.connect(bobIdentity)

    await bob.request('hub/subscribe', { param: { topicID: TOPIC } })
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    await delay(20)

    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('hi') } })

    const msg = await reader.read()
    expect(msg.done).toBe(false)
    expect(msg.value?.topicID).toBe(TOPIC)
    expect(msg.value?.payload).toBe(encodePayload('hi'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })

  test('publish to a topic with no subscribers stores nothing', async () => {
    const store = createMemoryStore()
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()

    await alice.request('hub/publish', {
      param: { topicID: TOPIC, payload: encodePayload('void') },
    })
    await delay(20)

    expect(await store.getSubscribers(TOPIC)).toEqual([])
    expect((await store.fetch({ recipientDID: 'did:key:nobody' })).messages).toHaveLength(0)
    await ctx.dispose()
  })

  test('offline subscriber receives queued messages on connect', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()

    const { client: bobSetup } = ctx.connect(bobIdentity)
    await bobSetup.request('hub/subscribe', { param: { topicID: TOPIC } })

    await alice.request('hub/publish', {
      param: { topicID: TOPIC, payload: encodePayload('queued') },
    })
    await delay(20)

    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    expect(msg.value?.payload).toBe(encodePayload('queued'))

    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })

  test('ack drains the store', async () => {
    const store = createMemoryStore()
    const ackSpy = vi.spyOn(store, 'ack')
    const ctx = createTestHub({ store })
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()
    const { client: bobSetup } = ctx.connect(bobIdentity)
    await bobSetup.request('hub/subscribe', { param: { topicID: TOPIC } })

    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('m1') } })
    await delay(20)

    const { client: bob } = ctx.connect(bobIdentity)
    const channel = bob.createChannel('hub/receive', { param: {} })
    const reader = channel.readable.getReader()
    const msg = await reader.read()
    const sequenceID = msg.value?.sequenceID as string
    await channel.send({ ack: [sequenceID] })
    await delay(20)

    expect(ackSpy).toHaveBeenCalledWith({ recipientDID: bobIdentity.id, sequenceIDs: [sequenceID] })
    channel.close()
    await expect(channel).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })

  test('unsubscribe stops further delivery', async () => {
    const ctx = createTestHub()
    const { client: alice } = ctx.connect()
    const bobIdentity = randomIdentity()
    const { client: bob } = ctx.connect(bobIdentity)

    await bob.request('hub/subscribe', { param: { topicID: TOPIC } })
    await bob.request('hub/unsubscribe', { param: { topicID: TOPIC } })

    expect(await ctx.store.getSubscribers(TOPIC)).toEqual([])
    await alice.request('hub/publish', {
      param: { topicID: TOPIC, payload: encodePayload('gone') },
    })
    await delay(20)
    expect((await ctx.store.fetch({ recipientDID: bobIdentity.id })).messages).toHaveLength(0)
    await ctx.dispose()
  })

  test('hub/receive rejects a second concurrent open for the same DID', async () => {
    const ctx = createTestHub()
    const bobIdentity = randomIdentity()
    const { client: bob } = ctx.connect(bobIdentity)
    const channel1 = bob.createChannel('hub/receive', { param: {} })
    channel1.readable.getReader()
    await delay(20)

    const channel2 = bob.createChannel('hub/receive', { param: {} })
    await expect(channel2).rejects.toThrow('already bound')

    channel1.close()
    await expect(channel1).rejects.toEqual('Close')
    await delay(20)
    await ctx.dispose()
  })
})

describe('hub authorization', () => {
  test('authorize=false rejects publish and subscribe', async () => {
    const ctx = createTestHub({ authorize: () => false })
    const { client: alice } = ctx.connect()
    await expect(
      alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('x') } }),
    ).rejects.toThrow('Not authorized')
    await expect(alice.request('hub/subscribe', { param: { topicID: TOPIC } })).rejects.toThrow(
      'Not authorized',
    )
    await ctx.dispose()
  })
})

describe('hub rate limiting', () => {
  test('rejects publishes beyond the per-DID burst', async () => {
    const ctx = createTestHub({ rateLimits: { perDID: { rate: 0, burst: 2 } } })
    const { client: alice } = ctx.connect()
    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('1') } })
    await alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('2') } })
    await expect(
      alice.request('hub/publish', { param: { topicID: TOPIC, payload: encodePayload('3') } }),
    ).rejects.toThrow('rate limit')
    await ctx.dispose()
  })
})

describe('hub key packages', () => {
  test('upload then fetch consumes packages', async () => {
    const ctx = createTestHub()
    const { client: alice, identity } = ctx.connect()
    const uploaded = await alice.request('hub/keypackage/upload', {
      param: { keyPackages: ['kp-1', 'kp-2'] },
    })
    expect(uploaded.stored).toBe(2)

    const { client: bob } = ctx.connect()
    const fetched = await bob.request('hub/keypackage/fetch', {
      param: { did: identity.id, count: 1 },
    })
    expect(fetched.keyPackages).toEqual(['kp-1'])
    await ctx.dispose()
  })
})
