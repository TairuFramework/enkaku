import { describe, expect, test } from 'vitest'

import { BackpressureError } from '../src/errors.js'
import { encodeFrame, type HubFrame } from '../src/frame.js'
import { createHubTunnelTransport } from '../src/transport.js'

import { FakeHub } from './fixtures/fake-hub.js'

describe('createHubTunnelTransport backpressure', () => {
  test('inbox overflow surfaces BackpressureError and tears down the session', async () => {
    const hub = new FakeHub()
    const sessionID = 's1'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'
    const inboxCapacity = 10

    const transport = createHubTunnelTransport<{ msg: string }, { msg: string }>({
      hub,
      sessionID,
      localDID,
      peerDID,
      inboxCapacity,
    })

    try {
      expect(hub.subscriberCount(localDID)).toBe(1)

      const total = 50
      for (let i = 0; i < total; i++) {
        const frame: HubFrame = {
          v: 1,
          sessionID,
          kind: 'message',
          seq: i,
          body: { header: {}, payload: { typ: 'test', msg: `m-${i}` } },
        }
        await hub.send({
          senderDID: peerDID,
          recipients: [localDID],
          payload: encodeFrame(frame),
        })
      }

      let captured: unknown
      for (let attempt = 0; attempt < total + 5; attempt++) {
        try {
          await transport.read()
        } catch (error) {
          captured = error
          break
        }
      }

      expect(captured).toBeInstanceOf(BackpressureError)
      expect((captured as BackpressureError).message).toContain('inbox overflow')

      expect(hub.subscriberCount(localDID)).toBe(0)

      await expect(transport.read()).rejects.toBeInstanceOf(BackpressureError)
    } finally {
      try {
        await transport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
    }
  })
})
