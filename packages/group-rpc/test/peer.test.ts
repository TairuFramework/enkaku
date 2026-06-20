import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { createGroupPeer } from '../src/peer.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'

const flush = () => new Promise((r) => setTimeout(r, 30))

const chat = {
  'chat/changed': { type: 'event', data: { type: 'object' } },
  'chat/echo': { type: 'request', param: { type: 'object' }, result: { type: 'object' } },
  'chat/double': { type: 'request', param: { type: 'object' }, result: { type: 'object' } },
} as unknown as ProtocolDefinition

type Protocols = { chat: typeof chat }

function makePeer(hub: FakeHub, localDID: string, handlers: Record<string, unknown>) {
  const crypto = createFakeCrypto({ epoch: 1, localDID })
  const peer = createGroupPeer<Protocols>({
    hub,
    crypto,
    localDID,
    protocols: { chat },
    handlers: { chat: handlers } as never,
  })
  return { peer, crypto }
}

describe('createGroupPeer', () => {
  test('bus event reaches all subscribed members with the sender', async () => {
    const hub = new FakeHub()
    const seen: Array<{ data: unknown; from?: string }> = []
    const alice = makePeer(hub, 'alice', {})
    makePeer(hub, 'bob', {
      'chat/changed': (ctx: { data: unknown; message: { payload: { iss?: string } } }) =>
        void seen.push({ data: ctx.data, from: ctx.message.payload.iss }),
    })
    await flush()

    await alice.peer.protocol('chat').dispatch('chat/changed', { text: 'hi' })
    await flush()
    expect(seen).toEqual([{ data: { text: 'hi' }, from: 'alice' }])
  })

  test('anycast request returns one reply', async () => {
    const hub = new FakeHub()
    const alice = makePeer(hub, 'alice', {})
    makePeer(hub, 'bob', {
      'chat/echo': (ctx: { param: unknown }) => ({ from: 'bob', echoed: ctx.param }),
    })
    await flush()
    const reply = await alice.peer
      .protocol('chat')
      .request('chat/echo', { x: 1 }, { timeoutMs: 500 })
    expect(reply).toEqual({ from: 'bob', echoed: { x: 1 } })
  })

  test('gather collects replies from multiple members', async () => {
    const hub = new FakeHub()
    const alice = makePeer(hub, 'alice', {})
    makePeer(hub, 'bob', { 'chat/echo': () => ({ from: 'bob' }) })
    makePeer(hub, 'carol', { 'chat/echo': () => ({ from: 'carol' }) })
    await flush()
    const replies = await alice.peer.protocol('chat').gather('chat/echo', {}, { timeoutMs: 300 })
    const froms = replies.map((r) => (r.value as { from: string }).from).sort()
    expect(froms).toEqual(['bob', 'carol'])
  })

  test('directed request via .to(memberDID)', async () => {
    const hub = new FakeHub()
    const alice = makePeer(hub, 'alice', {})
    makePeer(hub, 'bob', {
      'chat/double': (ctx: { param: { n: number } }) => ({ n: ctx.param.n * 2 }),
    })
    await flush()
    const result = await alice.peer
      .protocol('chat')
      .to('bob')
      .request('chat/double', { param: { n: 21 } })
    expect(result).toEqual({ n: 42 })
  })

  test('resync rotates topics; only the new epoch delivers', async () => {
    const hub = new FakeHub()
    const seen: Array<unknown> = []
    const alice = makePeer(hub, 'alice', {})
    const bob = makePeer(hub, 'bob', {
      'chat/changed': (ctx: { data: unknown }) => void seen.push(ctx.data),
    })
    await flush()

    alice.crypto.setEpoch(2)
    bob.crypto.setEpoch(2)
    await alice.peer.resync()
    await bob.peer.resync()
    await flush()

    await alice.peer.protocol('chat').dispatch('chat/changed', { e: 2 })
    await flush()
    expect(seen).toEqual([{ e: 2 }])

    await alice.peer.dispose()
    await bob.peer.dispose()
  })
})
