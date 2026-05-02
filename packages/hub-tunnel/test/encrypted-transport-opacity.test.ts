import { fromB64 } from '@enkaku/codec'
import { describe, expect, test } from 'vitest'

import { createEncryptedHubTunnelTransport } from '../src/encrypted-transport.js'
import { decodeEnvelope } from '../src/envelope.js'

import { FakeEncryptor } from './fixtures/fake-encryptor.js'
import { FakeHub } from './fixtures/fake-hub.js'

const MARKER = 'SECRET-PAYLOAD-MARKER-XYZ123'
const FORBIDDEN_FRAME_TOKENS = ['"sessionID"', '"kind"', '"seq"', '"correlationID"']

type Msg = {
  header: Record<string, unknown>
  payload: { typ: string; name: string; value: { msg: string } }
}

describe('createEncryptedHubTunnelTransport wire opacity', () => {
  test('hub/send payload bytes contain no plaintext frame fields or body markers', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-opacity'
    const groupID = 'group-opacity'
    const aDID = 'did:peer:opacity-a'
    const bDID = 'did:peer:opacity-b'

    const sharedKey = new Uint8Array([0x9e, 0x21, 0xb7, 0x05, 0xc4, 0x6f, 0x83, 0x1d])
    const aEncryptor = new FakeEncryptor({ key: sharedKey })
    const bEncryptor = new FakeEncryptor({ key: sharedKey })

    const sentPayloads: Array<Uint8Array> = []
    const recordingHub = {
      send: async (params: Parameters<typeof hub.send>[0]) => {
        sentPayloads.push(params.payload)
        return await hub.send(params)
      },
      receive: hub.receive.bind(hub),
      events: hub.events,
    }

    const aTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub: recordingHub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
      encryptor: aEncryptor,
      groupID,
    })
    const bTransport = createEncryptedHubTunnelTransport<Msg, Msg>({
      hub: recordingHub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      encryptor: bEncryptor,
      groupID,
    })

    try {
      const message: Msg = {
        header: {},
        payload: { typ: 'request', name: 'echo/ping', value: { msg: MARKER } },
      }
      await aTransport.write(message)

      const received = await bTransport.read()
      expect(received.value).toEqual(message)

      expect(sentPayloads.length).toBe(1)
      const payload = sentPayloads[0] as Uint8Array
      const wireText = new TextDecoder().decode(payload)

      const envelope = decodeEnvelope(payload)
      expect(envelope.v).toBe(1)
      expect(envelope.groupID).toBe(groupID)
      expect(typeof envelope.ciphertext).toBe('string')
      expect(envelope.ciphertext.length).toBeGreaterThan(0)

      for (const token of FORBIDDEN_FRAME_TOKENS) {
        expect(wireText).not.toContain(token)
      }

      expect(wireText).not.toContain(MARKER)

      const ciphertextBytes = fromB64(envelope.ciphertext)
      const ciphertextText = new TextDecoder('utf-8', { fatal: false }).decode(ciphertextBytes)
      expect(ciphertextText).not.toContain(MARKER)
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
