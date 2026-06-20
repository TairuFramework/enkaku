import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test } from 'vitest'

import { createGroupPeer } from '../src/peer.js'
import { handshakeTopic, protocolTopic } from '../src/topic.js'
import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'
import { createFakeMLS } from './fixtures/fake-mls.js'

const flush = () => new Promise((r) => setTimeout(r, 30))

const chat = {
  'chat/changed': { type: 'event', data: { type: 'object' } },
} as const satisfies ProtocolDefinition

type Protocols = { chat: typeof chat }

describe('handshake topic lifecycle', () => {
  test('subscribed once at init, survives resync, dropped on dispose', async () => {
    const hub = new FakeHub()
    const recoverySecret = new Uint8Array(32).fill(0x33)
    const crypto = createFakeCrypto({ epoch: 1, localDID: 'alice' })
    const mls = createFakeMLS({ recoverySecret })
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
})
