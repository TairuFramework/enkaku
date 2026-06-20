import { fromUTF, toUTF } from '@enkaku/codec'
import type { StoredMessage } from '@enkaku/hub-protocol'
import { describe, expect, test } from 'vitest'

import { createHubMux } from '../src/hub-mux.js'
import { FakeHub } from './fixtures/fake-hub.js'

const flush = () => new Promise((r) => setTimeout(r, 10))

describe('createHubMux', () => {
  test('bus.subscribe receives payloads published to the topic (one real subscribe)', async () => {
    const hub = new FakeHub()
    const mux = createHubMux({ hub, localDID: 'bob' })
    const got: Array<string> = []
    const unsub = mux.bus.subscribe('topic:x', (bytes) => got.push(toUTF(bytes)))
    expect(hub.subscriberCount('topic:x')).toBe(1)

    await hub.publish({ senderDID: 'alice', topicID: 'topic:x', payload: fromUTF('m1') })
    await flush()
    expect(got).toEqual(['m1'])

    unsub()
    expect(hub.subscriberCount('topic:x')).toBe(0)
    await mux.dispose()
  })

  test('refcounts overlapping subscriptions to the same topic', async () => {
    const hub = new FakeHub()
    const mux = createHubMux({ hub, localDID: 'bob' })
    const a = mux.bus.subscribe('topic:y', () => {})
    const b = mux.onInbound('topic:y', () => {})
    expect(hub.subscriberCount('topic:y')).toBe(1)
    a()
    expect(hub.subscriberCount('topic:y')).toBe(1)
    b()
    expect(hub.subscriberCount('topic:y')).toBe(0)
    await mux.dispose()
  })

  test('onInbound fires before sinks receive, exposing senderDID', async () => {
    const hub = new FakeHub()
    const mux = createHubMux({ hub, localDID: 'bob' })
    const order: Array<string> = []
    const senders: Array<string> = []
    mux.onInbound('topic:z', (msg: StoredMessage) => {
      order.push('onInbound')
      senders.push(msg.senderDID)
    })
    const sub = mux.hubLike.receive('bob')
    void (async () => {
      for await (const _msg of sub) order.push('sink')
    })()
    await flush()

    await hub.publish({ senderDID: 'alice', topicID: 'topic:z', payload: fromUTF('m') })
    await flush()
    expect(order).toEqual(['onInbound', 'sink'])
    expect(senders).toEqual(['alice'])
    sub.return?.()
    await mux.dispose()
  })

  test('hubLike.publish forwards the provided senderDID', async () => {
    const hub = new FakeHub()
    const mux = createHubMux({ hub, localDID: 'bob' })
    const other = createHubMux({ hub, localDID: 'carol' })
    let seen: StoredMessage | undefined
    other.onInbound('topic:p', (msg) => {
      seen = msg
    })
    await mux.hubLike.publish({ senderDID: 'bob', topicID: 'topic:p', payload: fromUTF('hey') })
    await flush()
    expect(seen?.senderDID).toBe('bob')
    expect(toUTF(seen?.payload ?? new Uint8Array())).toBe('hey')
    await mux.dispose()
    await other.dispose()
  })

  test('dispose stops the drain and unsubscribes remaining topics', async () => {
    const hub = new FakeHub()
    const mux = createHubMux({ hub, localDID: 'bob' })
    mux.bus.subscribe('topic:q', () => {})
    expect(hub.subscriberCount('topic:q')).toBe(1)
    await mux.dispose()
    expect(hub.subscriberCount('topic:q')).toBe(0)
  })

  test('a sink created inside an onInbound listener receives the triggering message (lazy-accept race)', async () => {
    const hub = new FakeHub()
    const mux = createHubMux({ hub, localDID: 'bob' })
    const got: Array<string> = []
    let started = false
    // Mirrors the directed inbox acceptor: onInbound synchronously creates a
    // receive sink on first inbound, which must still receive that first frame.
    mux.onInbound('topic:lazy', () => {
      if (started) return
      started = true
      const sub = mux.hubLike.receive('bob')
      void (async () => {
        for await (const msg of sub) got.push(toUTF(msg.payload))
      })()
    })

    await hub.publish({ senderDID: 'alice', topicID: 'topic:lazy', payload: fromUTF('first') })
    await flush()
    expect(got).toEqual(['first'])
    await mux.dispose()
  })
})
