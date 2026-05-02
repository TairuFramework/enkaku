import { AbortInterruption, TimeoutInterruption } from '@enkaku/async'
import { describe, expect, test } from 'vitest'

import { encodeFrame, type HubFrame, type HubFrameMessageBody } from '../src/frame.js'
import { createHubTunnelTransport } from '../src/transport.js'

import { FakeHub } from './fixtures/fake-hub.js'

type Msg = HubFrameMessageBody

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const sendInboundFrame = async (
  hub: FakeHub,
  sessionID: string,
  peerDID: string,
  localDID: string,
  seq: number,
  msg: string,
): Promise<void> => {
  const frame: HubFrame = {
    v: 1,
    sessionID,
    kind: 'message',
    seq,
    body: { header: {}, payload: { typ: 'test', msg } },
  }
  await hub.send({
    senderDID: peerDID,
    recipients: [localDID],
    payload: encodeFrame(frame),
  })
}

describe('createHubTunnelTransport lifecycle', () => {
  test('abort signal raises AbortInterruption and cancels subscription', async () => {
    const hub = new FakeHub()
    const sessionID = 's-abort'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'
    const controller = new AbortController()

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
      signal: controller.signal,
    })

    try {
      expect(hub.subscriberCount(localDID)).toBe(1)

      await sendInboundFrame(hub, sessionID, peerDID, localDID, 0, 'first')
      const first = await transport.read()
      expect((first.value as Msg).payload.msg).toBe('first')

      controller.abort(new Error('user cancel'))

      await expect(transport.read()).rejects.toBeInstanceOf(AbortInterruption)
      expect(hub.subscriberCount(localDID)).toBe(0)

      await expect(transport.read()).rejects.toBeInstanceOf(AbortInterruption)
    } finally {
      try {
        await transport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
    }
  })

  test('pre-aborted signal rejects first read with AbortInterruption', async () => {
    const hub = new FakeHub()
    const sessionID = 's-pre-abort'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'
    const controller = new AbortController()
    controller.abort(new Error('already cancelled'))

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
      signal: controller.signal,
    })

    try {
      await expect(transport.read()).rejects.toBeInstanceOf(AbortInterruption)
      expect(hub.subscriberCount(localDID)).toBe(0)
    } finally {
      try {
        await transport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
    }
  })

  test('idle timeout raises TimeoutInterruption and tears down', async () => {
    const hub = new FakeHub()
    const sessionID = 's-idle'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
      idleTimeoutMs: 50,
    })

    try {
      expect(hub.subscriberCount(localDID)).toBe(1)
      await expect(transport.read()).rejects.toBeInstanceOf(TimeoutInterruption)
      expect(hub.subscriberCount(localDID)).toBe(0)
    } finally {
      try {
        await transport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
    }
  })

  test('inbound activity resets idle timer', async () => {
    const hub = new FakeHub()
    const sessionID = 's-idle-reset'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      peerDID,
      idleTimeoutMs: 100,
    })

    try {
      await sleep(50)
      await sendInboundFrame(hub, sessionID, peerDID, localDID, 0, 'keepalive')
      const result = await transport.read()
      expect((result.value as Msg).payload.msg).toBe('keepalive')

      await sleep(60)
      expect(hub.subscriberCount(localDID)).toBe(1)

      await expect(transport.read()).rejects.toBeInstanceOf(TimeoutInterruption)
      expect(hub.subscriberCount(localDID)).toBe(0)
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
