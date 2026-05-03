import { describe, expect, test } from 'vitest'

import { FakeHub, type FakeHubMessage } from './fixtures/fake-hub.js'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

async function collect(
  iterable: AsyncIterable<FakeHubMessage>,
  count: number,
): Promise<Array<FakeHubMessage>> {
  const out: Array<FakeHubMessage> = []
  for await (const message of iterable) {
    out.push(message)
    if (out.length >= count) break
  }
  return out
}

describe('FakeHub fixture', () => {
  test('delivers frames in order from sender to recipient', async () => {
    const hub = new FakeHub()
    const a = 'did:key:alice'
    const b = 'did:key:bob'

    const subscription = hub.receive(b)
    const received = collect(subscription, 5)

    for (let i = 0; i < 5; i++) {
      await hub.send({
        senderDID: a,
        recipients: [b],
        payload: textEncoder.encode(`msg-${i}`),
      })
    }

    const messages = await received
    expect(messages).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(messages[i].senderDID).toBe(a)
      expect(textDecoder.decode(messages[i].payload)).toBe(`msg-${i}`)
    }
    subscription.return()
  })

  test('dropNext skips the next outbound delivery', async () => {
    const hub = new FakeHub()
    const a = 'did:key:alice'
    const b = 'did:key:bob'

    const subscription = hub.receive(b)
    const received = collect(subscription, 4)

    hub.dropNext(1)
    for (let i = 0; i < 5; i++) {
      await hub.send({
        senderDID: a,
        recipients: [b],
        payload: textEncoder.encode(`msg-${i}`),
      })
    }

    const messages = await received
    expect(messages).toHaveLength(4)
    expect(messages.map((m) => textDecoder.decode(m.payload))).toEqual([
      'msg-1',
      'msg-2',
      'msg-3',
      'msg-4',
    ])
    subscription.return()
  })

  test('disconnect closes the receive iterator for the device', async () => {
    const hub = new FakeHub()
    const b = 'did:key:bob'
    const subscription = hub.receive(b)
    const iterator = subscription[Symbol.asyncIterator]()

    const next = iterator.next()
    hub.disconnect(b)
    const result = await next
    expect(result.done).toBe(true)
  })
})
