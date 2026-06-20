import { describe, expect, test } from 'vitest'

import { HubReconnectingError } from '../src/errors.js'
import { encodeFrame, type HubFrame, type HubFrameMessageBody } from '../src/frame.js'
import {
  createHubTunnelTransport,
  type HubLike,
  type HubReceiveSubscription,
} from '../src/transport.js'

import { FakeHub } from './fixtures/fake-hub.js'

type Msg = HubFrameMessageBody

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const sendInboundFrame = async (
  hub: FakeHub,
  sessionID: string,
  peerDID: string,
  localDID: string,
  receiveTopicID: string,
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
  hub.subscribe(localDID, receiveTopicID)
  await hub.publish({
    senderDID: peerDID,
    topicID: receiveTopicID,
    payload: encodeFrame(frame),
  })
}

describe('createHubTunnelTransport reconnect', () => {
  test('reconnect timeout fires HubReconnectingError and tears down', async () => {
    const hub = new FakeHub()
    const sessionID = 's-reconnect'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'
    const topicA = 'topic:a'
    const topicB = 'topic:b'

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      sendTopicID: topicB,
      receiveTopicID: topicA,
      reconnectTimeoutMs: 50,
    })

    try {
      expect(hub.subscriberCount(localDID)).toBe(1)

      await sendInboundFrame(hub, sessionID, peerDID, localDID, topicA, 0, 'hello')
      const first = await transport.read()
      expect((first.value as Msg).payload.msg).toBe('hello')

      hub.simulateReconnecting()

      await expect(transport.read()).rejects.toBeInstanceOf(HubReconnectingError)
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

  test('connected event clears pending reconnect timer', async () => {
    const hub = new FakeHub()
    const sessionID = 's-reconnect-cleared'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'
    const topicA = 'topic:a'
    const topicB = 'topic:b'

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub,
      sessionID,
      localDID,
      sendTopicID: topicB,
      receiveTopicID: topicA,
      reconnectTimeoutMs: 200,
    })

    try {
      hub.simulateReconnecting()
      await sleep(50)
      hub.simulateConnected()
      await sleep(250)

      expect(hub.subscriberCount(localDID)).toBe(1)

      await sendInboundFrame(hub, sessionID, peerDID, localDID, topicA, 0, 'after-reconnect')
      const result = await transport.read()
      expect((result.value as Msg).payload.msg).toBe('after-reconnect')
    } finally {
      try {
        await transport.dispose()
      } catch {
        // ignore
      }
      hub.disconnect(localDID)
    }
  })

  test('hub without events ignores reconnectTimeoutMs gracefully', async () => {
    const fakeHub = new FakeHub()
    const sessionID = 's-no-events'
    const localDID = 'did:peer:local'
    const peerDID = 'did:peer:remote'
    const topicA = 'topic:a'
    const topicB = 'topic:b'

    const hubWithoutEvents: HubLike = {
      publish: (params) => fakeHub.publish(params),
      subscribe: (subscriberDID: string, topicID: string) =>
        fakeHub.subscribe(subscriberDID, topicID),
      receive: (subscriberDID: string): HubReceiveSubscription => fakeHub.receive(subscriberDID),
    }

    const transport = createHubTunnelTransport<Msg, Msg>({
      hub: hubWithoutEvents,
      sessionID,
      localDID,
      sendTopicID: topicB,
      receiveTopicID: topicA,
      reconnectTimeoutMs: 50,
    })

    try {
      await sleep(100)
      expect(fakeHub.subscriberCount(localDID)).toBe(1)

      await sendInboundFrame(fakeHub, sessionID, peerDID, localDID, topicA, 0, 'still-alive')
      const result = await transport.read()
      expect((result.value as Msg).payload.msg).toBe('still-alive')
    } finally {
      try {
        await transport.dispose()
      } catch {
        // ignore
      }
      fakeHub.disconnect(localDID)
    }
  })
})
