import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { encodeHandshakeFrame, HANDSHAKE_KIND } from '../src/handshake.js'
import { createMemoryGroupMLS } from '../src/memory-group-mls.js'
import { createGroupPeer } from '../src/peer.js'
import { handshakeTopic } from '../src/topic.js'
import { DurableFakeHub } from './fixtures/durable-fake-hub.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'

const flush = () => new Promise((r) => setTimeout(r, 30))

const chat = {
  'chat/changed': { type: 'event', data: { type: 'object' } },
} as const satisfies ProtocolDefinition

type Protocols = { chat: typeof chat }

function makeDurablePeer(hub: DurableFakeHub, localDID: string, recoverySecret: Uint8Array) {
  const crypto = createFakeCrypto({ epoch: 1, localDID })
  const mls = createMemoryGroupMLS({
    recoverySecret,
    epoch: 1,
    onAdvance: (e) => crypto.setEpoch(e),
  })
  const peer = createGroupPeer<Protocols>({
    hub,
    crypto,
    mls,
    localDID,
    protocols: { chat },
    handlers: { chat: {} } as never,
  })
  return { peer, crypto, mls }
}

function publishCommit(
  hub: DurableFakeHub,
  senderDID: string,
  recoverySecret: Uint8Array,
  commit: Uint8Array,
): Promise<{ sequenceID: string }> {
  return hub.publish({
    senderDID,
    topicID: handshakeTopic(recoverySecret),
    payload: encodeHandshakeFrame(HANDSHAKE_KIND.commit, commit),
  })
}

describe('handshake tier-1 replay', () => {
  test('acked Commits are not redelivered; missed Commits replay on reconnect', async () => {
    const hub = new DurableFakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x66)
    const bob = makeDurablePeer(hub, 'bob', recoverySecret)
    await flush()

    // Online: a Commit is processed and acked.
    await publishCommit(hub, 'alice', recoverySecret, new Uint8Array([1]))
    await flush()
    expect(bob.mls.epoch()).toBe(2)
    expect(bob.mls.commits()).toBe(1)
    expect(hub.ackedCount('bob')).toBe(1)

    // Reconnect: the acked Commit is NOT redelivered, so it is not reprocessed.
    hub.redeliver('bob')
    await flush()
    expect(bob.mls.epoch()).toBe(2)
    expect(bob.mls.commits()).toBe(1)

    // Offline: a Commit is published while detached and missed.
    hub.detach('bob')
    await publishCommit(hub, 'alice', recoverySecret, new Uint8Array([2]))
    await flush()
    expect(bob.mls.epoch()).toBe(2)

    // Reconnect: the unacked Commit replays and is processed.
    hub.reattach('bob')
    hub.redeliver('bob')
    await flush()
    expect(bob.mls.epoch()).toBe(3)
    expect(bob.mls.commits()).toBe(2)
    expect(hub.ackedCount('bob')).toBe(2)

    await bob.peer.dispose()
  })
})
