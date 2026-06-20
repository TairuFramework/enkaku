import { deriveTopicID } from '@enkaku/broadcast'
import { describe, expect, test } from 'vitest'

import { discoveryTopic, INBOX_LABEL, inboxTopic, protocolTopic } from '../src/topic.js'

const SECRET = new Uint8Array(32).fill(7)

describe('topic derivation', () => {
  test('protocolTopic matches deriveTopicID for the protocol label', () => {
    expect(protocolTopic(SECRET, 1, 'control')).toBe(deriveTopicID(SECRET, 1, 'control'))
  })

  test('protocolTopic scope discriminates subgroups', () => {
    const a = protocolTopic(SECRET, 1, 'sync', 'roomA')
    const b = protocolTopic(SECRET, 1, 'sync', 'roomB')
    expect(a).not.toBe(b)
    expect(a).toBe(deriveTopicID(SECRET, 1, 'sync', 'roomA'))
  })

  test('inboxTopic uses the reserved inbox label with the DID as scope', () => {
    expect(inboxTopic(SECRET, 1, 'did:key:zABC')).toBe(
      deriveTopicID(SECRET, 1, INBOX_LABEL, 'did:key:zABC'),
    )
  })

  test('inbox and protocol topics never collide for the same name', () => {
    expect(inboxTopic(SECRET, 1, 'control')).not.toBe(protocolTopic(SECRET, 1, 'control'))
  })

  test('topics rotate per epoch', () => {
    expect(protocolTopic(SECRET, 1, 'control')).not.toBe(protocolTopic(SECRET, 2, 'control'))
    expect(inboxTopic(SECRET, 1, 'did:key:zABC')).not.toBe(inboxTopic(SECRET, 2, 'did:key:zABC'))
  })

  test('discoveryTopic is a stable, secretless function of the DID', () => {
    const t = discoveryTopic('did:key:zABC')
    expect(t).toBe(discoveryTopic('did:key:zABC'))
    expect(t).not.toBe(discoveryTopic('did:key:zXYZ'))
    expect(typeof t).toBe('string')
    expect(t.length).toBeGreaterThan(0)
  })
})
