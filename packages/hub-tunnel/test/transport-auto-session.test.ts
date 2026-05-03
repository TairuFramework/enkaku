import type { StoreParams } from '@enkaku/hub-protocol'
import { describe, expect, test } from 'vitest'

import { SessionNotEstablishedError } from '../src/errors.js'
import type { ObservabilityEvent } from '../src/events.js'
import { decodeFrame, encodeFrame, type HubFrame, type HubFrameMessageBody } from '../src/frame.js'
import { createHubTunnelTransport, type HubLike } from '../src/transport.js'

import { FakeHub } from './fixtures/fake-hub.js'

type Msg = HubFrameMessageBody

describe('createHubTunnelTransport auto-sessionID', () => {
  test('locks to first inbound frame sessionID and accepts subsequent matching frames', async () => {
    const hub = new FakeHub()
    const sessionID = 's-auto-1'
    const localDID = 'did:peer:auto-local-1'
    const peerDID = 'did:peer:auto-remote-1'

    const receiver = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID: { auto: true },
      localDID,
      peerDID,
    })
    const sender = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: peerDID,
      peerDID: localDID,
    })

    try {
      await sender.write({ header: {}, payload: { typ: 'test', msg: 'hello' } })
      const first = await receiver.read()
      expect((first.value as Msg).payload.msg).toBe('hello')

      await sender.write({ header: {}, payload: { typ: 'test', msg: 'world' } })
      const second = await receiver.read()
      expect((second.value as Msg).payload.msg).toBe('world')
    } finally {
      try {
        await receiver.dispose()
      } catch {
        // ignore
      }
      try {
        await sender.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
      hub.disconnect(peerDID)
    }
  })

  test('after lock, frames with mismatched sessionID are dropped via session-mismatch event', async () => {
    const hub = new FakeHub()
    const sessionID = 's-auto-2'
    const localDID = 'did:peer:auto-local-2'
    const peerDID = 'did:peer:auto-remote-2'

    const events: Array<ObservabilityEvent> = []

    const receiver = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID: { auto: true },
      localDID,
      peerDID,
      onEvent: (event) => {
        events.push(event)
      },
    })
    const sender = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: peerDID,
      peerDID: localDID,
    })

    try {
      await sender.write({ header: {}, payload: { typ: 'test', msg: 'lock-me' } })
      const first = await receiver.read()
      expect((first.value as Msg).payload.msg).toBe('lock-me')

      const wrongFrame: HubFrame = {
        v: 1,
        sessionID: 'different-session',
        kind: 'message',
        seq: 0,
        body: { header: {}, payload: { typ: 'test', msg: 'should-be-dropped' } },
      }
      await hub.send({
        senderDID: peerDID,
        recipients: [localDID],
        payload: encodeFrame(wrongFrame),
      })

      await sender.write({ header: {}, payload: { typ: 'test', msg: 'after-bad' } })
      const next = await receiver.read()
      expect((next.value as Msg).payload.msg).toBe('after-bad')

      const dropped = events.filter(
        (e) => e.type === 'frame-dropped' && e.reason === 'session-mismatch',
      )
      expect(dropped.length).toBe(1)
    } finally {
      try {
        await receiver.dispose()
      } catch {
        // ignore
      }
      try {
        await sender.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
      hub.disconnect(peerDID)
    }
  })

  test('outbound write before session is locked rejects with SessionNotEstablishedError', async () => {
    const hub = new FakeHub()
    const localDID = 'did:peer:auto-local-3'
    const peerDID = 'did:peer:auto-remote-3'

    const receiver = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID: { auto: true },
      localDID,
      peerDID,
    })

    try {
      await expect(
        receiver.write({ header: {}, payload: { typ: 'test', msg: 'too-early' } }),
      ).rejects.toBeInstanceOf(SessionNotEstablishedError)
    } finally {
      try {
        await receiver.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
    }
  })

  test('outbound write after lock uses the locked sessionID on the wire', async () => {
    const hub = new FakeHub()
    const sessionID = 's-auto-4'
    const localDID = 'did:peer:auto-local-4'
    const peerDID = 'did:peer:auto-remote-4'

    const sentPayloads: Array<Uint8Array> = []
    const recordingHub: HubLike = {
      send: async (params: StoreParams) => {
        sentPayloads.push(params.payload)
        return await hub.send(params)
      },
      receive: hub.receive.bind(hub),
      events: hub.events,
    }

    const receiver = createHubTunnelTransport<Msg, Msg>({
      hub: recordingHub,
      sessionID: { auto: true },
      localDID,
      peerDID,
    })
    const sender = createHubTunnelTransport<Msg, Msg>({
      hub: recordingHub,
      sessionID,
      localDID: peerDID,
      peerDID: localDID,
    })

    try {
      await sender.write({ header: {}, payload: { typ: 'test', msg: 'lock' } })
      const first = await receiver.read()
      expect((first.value as Msg).payload.msg).toBe('lock')

      sentPayloads.length = 0
      await receiver.write({ header: {}, payload: { typ: 'test', msg: 'response' } })

      expect(sentPayloads.length).toBe(1)
      const outboundFrame = decodeFrame(sentPayloads[0] as Uint8Array)
      expect(outboundFrame.sessionID).toBe(sessionID)

      const echo = await sender.read()
      expect((echo.value as Msg).payload.msg).toBe('response')
    } finally {
      try {
        await receiver.dispose()
      } catch {
        // ignore
      }
      try {
        await sender.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
      hub.disconnect(peerDID)
    }
  })

  test('explicit string sessionID still works (backward compatibility)', async () => {
    const hub = new FakeHub()
    const sessionID = 's-compat'
    const localDID = 'did:peer:compat-local'
    const peerDID = 'did:peer:compat-remote'

    const receiver = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
    })
    const sender = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: peerDID,
      peerDID: localDID,
    })

    try {
      await receiver.write({ header: {}, payload: { typ: 'test', msg: 'first' } })
      const got = await sender.read()
      expect((got.value as Msg).payload.msg).toBe('first')
    } finally {
      try {
        await receiver.dispose()
      } catch {
        // ignore
      }
      try {
        await sender.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
      hub.disconnect(peerDID)
    }
  })
})
