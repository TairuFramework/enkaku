import { describe, expect, test } from 'vitest'

import type { HubFrameMessageBody } from '../src/frame.js'
import { createHubTunnelTransport } from '../src/transport.js'

import { FakeHub } from './fixtures/fake-hub.js'

type Msg = HubFrameMessageBody

describe('createHubTunnelTransport ordering', () => {
  test('duplicate frame redelivery is deduped silently', async () => {
    const hub = new FakeHub()
    const sessionID = 's1'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'

    const localTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
    })
    const peerTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: peerDID,
      peerDID: localDID,
    })

    try {
      const total = 5
      hub.duplicateNext(total)

      for (let i = 0; i < total; i++) {
        await peerTransport.write({ header: {}, payload: { typ: 'test', msg: `m-${i}` } })
      }

      const received: Array<string> = []
      for (let i = 0; i < total; i++) {
        const result = await localTransport.read()
        if (result.done) break
        received.push((result.value as Msg).payload.msg as string)
      }

      expect(received).toEqual(['m-0', 'm-1', 'm-2', 'm-3', 'm-4'])

      const raceResult = await Promise.race([
        localTransport.read().then(() => 'read'),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 50)),
      ])
      expect(raceResult).toBe('timeout')
    } finally {
      try {
        await localTransport.dispose()
      } catch {
        // ignore
      }
      try {
        await peerTransport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
      hub.disconnect(peerDID)
    }
  })

  test('forward seq gaps are tolerated without tearing down the session', async () => {
    const hub = new FakeHub()
    const sessionID = 's1'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'

    const localTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
    })
    const peerTransport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID: peerDID,
      peerDID: localDID,
    })

    try {
      expect(hub.subscriberCount(localDID)).toBe(1)

      const total = 5
      hub.dropNext(1)
      // The first outbound frame (seq=0) is dropped by the hub. Subsequent frames
      // (seq=1..4) should still be accepted by the receiver despite the missing seq=0.
      for (let i = 0; i < total; i++) {
        await peerTransport.write({ header: {}, payload: { typ: 'test', msg: `m-${i}` } })
      }

      const received: Array<string> = []
      for (let i = 0; i < total - 1; i++) {
        const result = await localTransport.read()
        if (result.done) break
        received.push((result.value as Msg).payload.msg as string)
      }

      expect(received).toEqual(['m-1', 'm-2', 'm-3', 'm-4'])
      expect(hub.subscriberCount(localDID)).toBe(1)
    } finally {
      try {
        await localTransport.dispose()
      } catch {
        // ignore
      }
      try {
        await peerTransport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
      hub.disconnect(peerDID)
    }
  })
})
