import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { createGroupPeer } from '../src/peer.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'

const flush = () => new Promise((r) => setTimeout(r, 40))

const chat = {
  'chat/census': { type: 'request', param: { type: 'object' }, result: { type: 'object' } },
} as const satisfies ProtocolDefinition

type Protocols = { chat: typeof chat }

function makePeer(hub: FakeHub, localDID: string, handlers: Record<string, unknown>) {
  return createGroupPeer<Protocols>({
    hub,
    crypto: createFakeCrypto({ epoch: 1, localDID }),
    localDID,
    protocols: { chat },
    handlers: { chat: handlers } as never,
    // Storm-collapse ENABLED for anycast request — must NOT break gather.
    suppress: { jitterMs: 5, suppressTtlMs: 1000 },
  })
}

describe('gather coexists with suppress config (footgun removed)', () => {
  test('gather collects all replies even when suppress is enabled', async () => {
    const hub = new FakeHub()
    const alice = makePeer(hub, 'alice', {})
    makePeer(hub, 'bob', { 'chat/census': () => ({ from: 'bob' }) })
    makePeer(hub, 'carol', { 'chat/census': () => ({ from: 'carol' }) })
    await flush()

    const replies = await alice.protocol('chat').gather('chat/census', {}, { timeoutMs: 300 })
    const froms = replies.map((r) => (r.value as { from: string }).from).sort()
    expect(froms).toEqual(['bob', 'carol'])

    await alice.dispose()
  })
})
