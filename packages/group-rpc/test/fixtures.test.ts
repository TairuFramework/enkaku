import { fromUTF, toUTF } from '@sozai/codec'
import { describe, expect, test } from 'vitest'

import { createFakeCrypto } from './fixtures/fake-crypto.js'
import { FakeHub } from './fixtures/fake-hub.js'

describe('fake crypto', () => {
  test('wrap then unwrap round-trips and recovers the sender', async () => {
    const crypto = createFakeCrypto({ localDID: 'did:key:alice' })
    const plain = fromUTF('hello group')
    const wrapped = await crypto.wrap(plain)
    expect(toUTF(wrapped)).not.toContain('hello group')
    const result = await crypto.unwrap(wrapped)
    const out = result instanceof Uint8Array ? { payload: result, senderDID: undefined } : result
    expect(toUTF(out.payload)).toBe('hello group')
    expect(out.senderDID).toBe('did:key:alice')
  })

  test('exposes epoch and exportSecret, epoch mutable for resync tests', async () => {
    const crypto = createFakeCrypto({ epoch: 1 })
    expect(crypto.epoch()).toBe(1)
    const secret = await crypto.exportSecret()
    expect(secret).toBeInstanceOf(Uint8Array)
    crypto.setEpoch(2)
    expect(crypto.epoch()).toBe(2)
  })
})

describe('fake hub', () => {
  test('delivers published payloads to topic subscribers, excluding the sender', async () => {
    const hub = new FakeHub()
    const received: Array<string> = []
    hub.subscribe('bob', 'topic:1')
    void (async () => {
      for await (const msg of hub.receive('bob')) received.push(toUTF(msg.payload))
    })()
    await hub.publish({ senderDID: 'alice', topicID: 'topic:1', payload: fromUTF('hi') })
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toEqual(['hi'])
  })

  test('does not deliver to the sender even if subscribed', async () => {
    const hub = new FakeHub()
    const received: Array<string> = []
    hub.subscribe('alice', 'topic:1')
    void (async () => {
      for await (const msg of hub.receive('alice')) received.push(toUTF(msg.payload))
    })()
    await hub.publish({ senderDID: 'alice', topicID: 'topic:1', payload: fromUTF('hi') })
    await new Promise((r) => setTimeout(r, 10))
    expect(received).toEqual([])
  })

  test('subscriberCount reflects subscribe/unsubscribe', () => {
    const hub = new FakeHub()
    expect(hub.subscriberCount('t')).toBe(0)
    hub.subscribe('a', 't')
    hub.subscribe('b', 't')
    expect(hub.subscriberCount('t')).toBe(2)
    hub.unsubscribe('a', 't')
    expect(hub.subscriberCount('t')).toBe(1)
  })
})
