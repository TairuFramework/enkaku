import { describe, expect, test } from 'vitest'

import { createEncryptedHubTunnelTransport } from '../src/encrypted-transport.js'
import type { Encryptor } from '../src/encryptor.js'
import { decodeEnvelope } from '../src/envelope.js'

import { FakeHub } from './fixtures/fake-hub.js'

const identityEncryptor: Encryptor = {
  encrypt: async (plaintext) => plaintext,
  decrypt: async (ciphertext) => ciphertext,
}

type Msg = { header: Record<string, unknown>; payload: { typ: string; [k: string]: unknown } }

describe('createEncryptedHubTunnelTransport', () => {
  test('round-trips a message via two encrypted tunnels over FakeHub', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-1'
    const groupID = 'group-1'
    const aDID = 'did:peer:a'
    const bDID = 'did:peer:b'

    const sentEnvelopes: Array<Uint8Array> = []
    const observedHub = {
      send: hub.send.bind(hub),
      receive: hub.receive.bind(hub),
      events: hub.events,
    }
    const recordingHub = {
      send: async (params: Parameters<typeof observedHub.send>[0]) => {
        sentEnvelopes.push(params.payload)
        return await observedHub.send(params)
      },
      receive: observedHub.receive,
      events: observedHub.events,
    }

    const aTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub: recordingHub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
      encryptor: identityEncryptor,
      groupID,
    })
    const bTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub: recordingHub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      encryptor: identityEncryptor,
      groupID,
    })

    try {
      const message: Msg = { header: {}, payload: { typ: 'test', hello: 'world' } }
      await aTransport.write(message)

      const received = await bTransport.read()
      expect(received.value).toEqual(message)

      expect(sentEnvelopes.length).toBe(1)
      const envelope = decodeEnvelope(sentEnvelopes[0] as Uint8Array)
      expect(envelope.v).toBe(1)
      expect(envelope.groupID).toBe(groupID)
      expect(typeof envelope.ciphertext).toBe('string')
      expect(envelope.ciphertext.length).toBeGreaterThan(0)
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

  test('drops frames whose envelope fails to decode without tearing down the session', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-2'
    const groupID = 'group-2'
    const aDID = 'did:peer:a2'
    const bDID = 'did:peer:b2'

    const aTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
      encryptor: identityEncryptor,
      groupID,
    })
    const bTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      encryptor: identityEncryptor,
      groupID,
    })

    try {
      await hub.send({
        senderDID: aDID,
        recipients: [bDID],
        payload: new TextEncoder().encode('not-an-envelope'),
      })

      const message: Msg = { header: {}, payload: { typ: 'test', ok: 1 } }
      await aTransport.write(message)
      const received = await bTransport.read()
      expect(received.value).toEqual(message)
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
