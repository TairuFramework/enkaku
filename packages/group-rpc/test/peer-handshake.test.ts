import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { encodeHandshakeFrame, HANDSHAKE_KIND } from '../src/handshake.js'
import { createMemoryGroupMLS } from '../src/memory-group-mls.js'
import { createGroupPeer } from '../src/peer.js'
import { handshakeTopic, protocolTopic } from '../src/topic.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'

const flush = () => new Promise((r) => setTimeout(r, 30))

const chat = {
  'chat/changed': { type: 'event', data: { type: 'object' } },
} as const satisfies ProtocolDefinition

type Protocols = { chat: typeof chat }

/** Build an MLS-enabled peer whose fake MLS keeps the fake crypto's epoch in step. */
function makeMLSPeer(hub: FakeHub, localDID: string, recoverySecret: Uint8Array) {
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

/** Publish a raw Commit frame to the group's handshake topic. */
function publishCommit(
  hub: FakeHub,
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

describe('handshake topic lifecycle', () => {
  test('subscribed once at init, survives resync, dropped on dispose', async () => {
    const hub = new FakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x33)
    const crypto = createFakeCrypto({ epoch: 1, localDID: 'alice' })
    const mls = createMemoryGroupMLS({ recoverySecret })
    const peer = createGroupPeer<Protocols>({
      hub,
      crypto,
      mls,
      localDID: 'alice',
      protocols: { chat },
      handlers: { chat: {} } as never,
    })
    await flush()

    const hsTopic = handshakeTopic(recoverySecret)
    const secret = await crypto.exportSecret()
    expect(hub.subscriberCount(hsTopic)).toBe(1)
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(1)

    // Advance the epoch and resync: app topics rotate, handshake topic persists.
    crypto.setEpoch(2)
    await peer.resync()
    await flush()

    expect(hub.subscriberCount(hsTopic)).toBe(1)
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(0)
    expect(hub.subscriberCount(protocolTopic(secret, 2, 'chat'))).toBe(1)

    await peer.dispose()
    await flush()
    expect(hub.subscriberCount(hsTopic)).toBe(0)
  })

  test('no handshake subscription when mls is omitted', async () => {
    const hub = new FakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x33)
    const crypto = createFakeCrypto({ epoch: 1, localDID: 'alice' })
    const peer = createGroupPeer<Protocols>({
      hub,
      crypto,
      localDID: 'alice',
      protocols: { chat },
      handlers: { chat: {} } as never,
    })
    await flush()

    expect(hub.subscriberCount(handshakeTopic(recoverySecret))).toBe(0)
    await peer.dispose()
  })

  test('a Commit advances and resyncs every receiver', async () => {
    const hub = new FakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x44)
    const bob = makeMLSPeer(hub, 'bob', recoverySecret)
    const carol = makeMLSPeer(hub, 'carol', recoverySecret)
    await flush()

    const secret = await bob.crypto.exportSecret()
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(2)

    await publishCommit(hub, 'alice', recoverySecret, new Uint8Array([1]))
    await flush()

    expect(bob.mls.epoch()).toBe(2)
    expect(carol.mls.epoch()).toBe(2)
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(0)
    expect(hub.subscriberCount(protocolTopic(secret, 2, 'chat'))).toBe(2)

    await bob.peer.dispose()
    await carol.peer.dispose()
  })

  test('a no-op Commit does not resync', async () => {
    const hub = new FakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x44)
    const bob = makeMLSPeer(hub, 'bob', recoverySecret)
    await flush()

    const secret = await bob.crypto.exportSecret()
    await publishCommit(hub, 'alice', recoverySecret, new Uint8Array())
    await flush()

    expect(bob.mls.epoch()).toBe(1)
    expect(bob.mls.commits()).toBe(0)
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(1)

    await bob.peer.dispose()
  })

  test('localCommitted publishes to receivers and resyncs the sender', async () => {
    const hub = new FakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x55)
    const alice = makeMLSPeer(hub, 'alice', recoverySecret)
    const bob = makeMLSPeer(hub, 'bob', recoverySecret)
    await flush()

    const secret = await alice.crypto.exportSecret()
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(2)

    // Alice produced a Commit and already applied it locally: advance her epoch.
    alice.crypto.setEpoch(2)
    await alice.peer.localCommitted(new Uint8Array([7]))
    await flush()

    // Bob received the Commit, advanced, and resynced; Alice rebuilt to epoch 2.
    expect(bob.mls.epoch()).toBe(2)
    expect(hub.subscriberCount(protocolTopic(secret, 1, 'chat'))).toBe(0)
    expect(hub.subscriberCount(protocolTopic(secret, 2, 'chat'))).toBe(2)

    await alice.peer.dispose()
    await bob.peer.dispose()
  })

  test('localCommitted is a no-op without an MLS port', async () => {
    const hub = new FakeHub()
    const crypto = createFakeCrypto({ epoch: 1, localDID: 'alice' })
    const peer = createGroupPeer<Protocols>({
      hub,
      crypto,
      localDID: 'alice',
      protocols: { chat },
      handlers: { chat: {} } as never,
    })
    await flush()
    await expect(peer.localCommitted(new Uint8Array([1]))).resolves.toBeUndefined()
    await peer.dispose()
  })
})
