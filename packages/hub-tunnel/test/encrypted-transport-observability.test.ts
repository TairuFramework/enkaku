import { describe, expect, test } from 'vitest'

import { createEncryptedHubTunnelTransport } from '../src/encrypted-transport.js'
import { DecryptError, EnvelopeDecodeError } from '../src/errors.js'
import type { ObservabilityEvent } from '../src/events.js'
import { encodeFrame, type HubFrame } from '../src/frame.js'
import { createHubTunnelTransport } from '../src/transport.js'

import { FakeEncryptor } from './fixtures/fake-encryptor.js'
import { FakeHub } from './fixtures/fake-hub.js'

const SHARED_KEY = new Uint8Array([0x42, 0x13, 0x37, 0x99])

type Msg = { header: Record<string, unknown>; payload: { typ: string; msg: string } }

const msg = (m: string): Msg => ({ header: {}, payload: { typ: 'test', msg: m } })

describe('hub-tunnel observability events', () => {
  test('envelope decode failure emits envelope-decode-failed and frame-dropped:envelope-decode', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-envelope'
    const groupID = 'group-envelope'
    const aDID = 'did:peer:obs-a-1'
    const bDID = 'did:peer:obs-b-1'

    const aEncryptor = new FakeEncryptor({ key: SHARED_KEY })
    const bEncryptor = new FakeEncryptor({ key: SHARED_KEY })

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
      await hub.send({
        senderDID: aDID,
        recipients: [bDID],
        payload: new TextEncoder().encode('not-an-envelope'),
      })

      await aTransport.write(msg('after'))
      const received = await bTransport.read()
      expect(received.value).toEqual(msg('after'))

      const decodeFailed = events.filter((e) => e.type === 'envelope-decode-failed')
      const dropped = events.filter(
        (e) => e.type === 'frame-dropped' && e.reason === 'envelope-decode',
      )
      expect(decodeFailed.length).toBe(1)
      const first = decodeFailed[0]
      if (first?.type !== 'envelope-decode-failed')
        throw new Error('expected envelope-decode-failed')
      expect(first.error).toBeInstanceOf(EnvelopeDecodeError)
      expect(dropped.length).toBe(1)
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

  test('decrypt failure emits decrypt-failed and frame-dropped:decrypt', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-decrypt'
    const groupID = 'group-decrypt'
    const aDID = 'did:peer:obs-a-2'
    const bDID = 'did:peer:obs-b-2'

    const aEncryptor = new FakeEncryptor({ key: SHARED_KEY })
    const bEncryptor = new FakeEncryptor({ key: SHARED_KEY })
    bEncryptor.failNextDecrypts(1)

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
      await aTransport.write(msg('lost'))
      await aTransport.write(msg('kept'))
      const received = await bTransport.read()
      expect(received.value).toEqual(msg('kept'))

      const decryptFailed = events.filter((e) => e.type === 'decrypt-failed')
      const dropped = events.filter((e) => e.type === 'frame-dropped' && e.reason === 'decrypt')
      expect(decryptFailed.length).toBe(1)
      const first = decryptFailed[0]
      if (first?.type !== 'decrypt-failed') throw new Error('expected decrypt-failed')
      expect(first.error).toBeInstanceOf(DecryptError)
      expect(dropped.length).toBe(1)
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

  test('sender mismatch emits frame-dropped:sender-mismatch', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-sender'
    const aDID = 'did:peer:obs-a-3'
    const bDID = 'did:peer:obs-b-3'
    const otherDID = 'did:peer:obs-other-3'

    const events: Array<ObservabilityEvent> = []

    const aTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
    })
    const bTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      onEvent: (event) => {
        events.push(event)
      },
    })

    try {
      const intruderFrame: HubFrame = {
        v: 1,
        sessionID,
        kind: 'message',
        seq: 0,
        body: { header: {}, payload: { typ: 'test', msg: 'intruder' } },
      }
      await hub.send({
        senderDID: otherDID,
        recipients: [bDID],
        payload: encodeFrame(intruderFrame),
      })

      await aTransport.write(msg('real'))
      const received = await bTransport.read()
      expect(received.value).toEqual(msg('real'))

      const dropped = events.filter(
        (e) => e.type === 'frame-dropped' && e.reason === 'sender-mismatch',
      )
      expect(dropped.length).toBe(1)
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

  test('session mismatch emits frame-dropped:session-mismatch', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-good'
    const aDID = 'did:peer:obs-a-4'
    const bDID = 'did:peer:obs-b-4'

    const events: Array<ObservabilityEvent> = []

    const aTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
    })
    const bTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      onEvent: (event) => {
        events.push(event)
      },
    })

    try {
      const wrongSessionFrame: HubFrame = {
        v: 1,
        sessionID: 'session-other',
        kind: 'message',
        seq: 0,
        body: { header: {}, payload: { typ: 'test', msg: 'wrong-session' } },
      }
      await hub.send({
        senderDID: aDID,
        recipients: [bDID],
        payload: encodeFrame(wrongSessionFrame),
      })

      await aTransport.write(msg('good'))
      const received = await bTransport.read()
      expect(received.value).toEqual(msg('good'))

      const dropped = events.filter(
        (e) => e.type === 'frame-dropped' && e.reason === 'session-mismatch',
      )
      expect(dropped.length).toBe(1)
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

  test('dedup emits frame-dropped:dedup on duplicate delivery', async () => {
    const hub = new FakeHub()
    const sessionID = 'session-dedup'
    const aDID = 'did:peer:obs-a-5'
    const bDID = 'did:peer:obs-b-5'

    const events: Array<ObservabilityEvent> = []

    const aTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: aDID,
      peerDID: bDID,
    })
    const bTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: bDID,
      peerDID: aDID,
      onEvent: (event) => {
        events.push(event)
      },
    })

    try {
      hub.duplicateNext(1)
      await aTransport.write(msg('once'))
      await aTransport.write(msg('twice'))

      const first = await bTransport.read()
      expect(first.value).toEqual(msg('once'))
      const second = await bTransport.read()
      expect(second.value).toEqual(msg('twice'))

      const dropped = events.filter((e) => e.type === 'frame-dropped' && e.reason === 'dedup')
      expect(dropped.length).toBe(1)
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
