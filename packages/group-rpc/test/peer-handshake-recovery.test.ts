import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { decodeHandshakeFrame, HANDSHAKE_KIND } from '../src/handshake.js'
import { createGroupPeer } from '../src/peer.js'
import { handshakeTopic, protocolTopic } from '../src/topic.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'
import { createFakeMLS } from './fixtures/fake-mls.js'

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms))

const chat = {
  'chat/changed': { type: 'event', data: { type: 'object' } },
} as const satisfies ProtocolDefinition

type Protocols = { chat: typeof chat }

function makePeer(
  hub: FakeHub,
  localDID: string,
  recoverySecret: Uint8Array,
  epoch: number,
  recovery?: { timeoutMs?: number; getDelayMs?: () => number },
) {
  const crypto = createFakeCrypto({ epoch, localDID })
  const mls = createFakeMLS({ recoverySecret, epoch, onAdvance: (e) => crypto.setEpoch(e) })
  const peer = createGroupPeer<Protocols>({
    hub,
    crypto,
    mls,
    localDID,
    protocols: { chat },
    handlers: { chat: {} } as never,
    ...(recovery != null ? { recovery } : {}),
  })
  return { peer, crypto, mls }
}

function recoveryReplyCount(hub: FakeHub, recoverySecret: Uint8Array): number {
  const topic = handshakeTopic(recoverySecret)
  return hub.published.filter(
    (m) =>
      m.topicID === topic && decodeHandshakeFrame(m.payload).kind === HANDSHAKE_KIND.recoveryReply,
  ).length
}

describe('handshake recovery rendezvous', () => {
  test('a stranded peer recovers and one responder wins (storm-collapse)', async () => {
    const hub = new FakeHub()
    const rs = new Uint8Array(32).fill(0x77)
    const carol = makePeer(hub, 'carol', rs, 3, { getDelayMs: () => 5 })
    const dave = makePeer(hub, 'dave', rs, 3, { getDelayMs: () => 60 })
    const eve = makePeer(hub, 'eve', rs, 1)
    await flush()

    const secret = await eve.crypto.exportSecret()
    const result = await eve.peer.recover()
    await flush(120)

    expect(result.advanced).toBe(true)
    expect(eve.mls.epoch()).toBe(3)
    expect(hub.subscriberCount(protocolTopic(secret, 3, 'chat'))).toBeGreaterThanOrEqual(1)
    // Carol (fast) replies; Dave (slow) observes that reply and suppresses its own.
    expect(recoveryReplyCount(hub, rs)).toBe(1)

    await carol.peer.dispose()
    await dave.peer.dispose()
    await eve.peer.dispose()
  })

  test('recover times out to advanced:false with no responders', async () => {
    const hub = new FakeHub()
    const rs = new Uint8Array(32).fill(0x88)
    const eve = makePeer(hub, 'eve', rs, 1, { timeoutMs: 40 })
    await flush()

    const result = await eve.peer.recover()
    expect(result.advanced).toBe(false)
    expect(eve.mls.epoch()).toBe(1)

    await eve.peer.dispose()
  })
})
