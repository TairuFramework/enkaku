import { describe, expect, test } from 'vitest'

import { createEncryptedHubTunnelTransport } from '../src/encrypted-transport.js'
import { DecryptError } from '../src/errors.js'
import type { ObservabilityEvent } from '../src/events.js'

import { FakeEncryptor } from './fixtures/fake-encryptor.js'
import { FakeHub } from './fixtures/fake-hub.js'

const SHARED_KEY = new Uint8Array([0x42, 0x13, 0x37, 0x99])

type Msg = { header: Record<string, unknown>; payload: { typ: string; msg: string } }

describe('createEncryptedHubTunnelTransport tampered ciphertext', () => {
  test('tampered ciphertext drops the frame, emits observability events, session continues', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-tampered'
    const groupID = 'group-tampered'
    const aDID = 'did:peer:a'
    const bDID = 'did:peer:b'

    const aEncryptor = new FakeEncryptor({ key: SHARED_KEY })
    const bEncryptor = new FakeEncryptor({ key: SHARED_KEY })

    aEncryptor.corruptNextCiphertexts(1)

    const events: Array<ObservabilityEvent> = []

    const aTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
      encryptor: aEncryptor,
      groupID,
    })
    const bTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      encryptor: bEncryptor,
      groupID,
      onEvent: (event) => {
        events.push(event)
      },
    })

    try {
      expect(hub.subscriberCount(bDID)).toBe(1)

      await aTransport.write({ header: {}, payload: { typ: 'test', msg: 'm-0' } })
      await aTransport.write({ header: {}, payload: { typ: 'test', msg: 'm-1' } })
      await aTransport.write({ header: {}, payload: { typ: 'test', msg: 'm-2' } })

      const received: Array<string> = []
      for (let i = 0; i < 2; i++) {
        const result = await bTransport.read()
        if (result.done) break
        received.push(result.value.payload.msg)
      }

      expect(received).toEqual(['m-1', 'm-2'])
      const decryptFailed = events.filter((e) => e.type === 'decrypt-failed')
      const dropped = events.filter((e) => e.type === 'frame-dropped' && e.reason === 'decrypt')
      expect(decryptFailed.length).toBe(1)
      const first = decryptFailed[0]
      if (first?.type !== 'decrypt-failed') throw new Error('expected decrypt-failed')
      expect(first.error).toBeInstanceOf(DecryptError)
      expect(dropped.length).toBe(1)
      expect(hub.subscriberCount(bDID)).toBe(1)
    } finally {
      try {
        await aTransport.dispose()
      } catch {
        // ignore
      }
      try {
        await bTransport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(aDID)
      hub.disconnect(bDID)
    }
  })
})
