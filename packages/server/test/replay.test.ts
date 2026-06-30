import { describe, expect, test } from 'vitest'

import { MemoryReplayCache } from '../src/replay.js'

describe('MemoryReplayCache', () => {
  test('records a fresh key once and rejects a duplicate', () => {
    const cache = new MemoryReplayCache({ now: () => 1_000 })
    expect(cache.checkAndRecord('k1', 10_000)).toBe(true)
    expect(cache.checkAndRecord('k1', 10_000)).toBe(false)
  })

  test('treats an expired entry as fresh again', () => {
    let now = 1_000
    const cache = new MemoryReplayCache({ now: () => now })
    expect(cache.checkAndRecord('k1', 5_000)).toBe(true)
    now = 5_001 // past expiresAt
    expect(cache.checkAndRecord('k1', 9_000)).toBe(true)
  })

  test('enforces maxEntries by evicting oldest', () => {
    const cache = new MemoryReplayCache({ maxEntries: 2, now: () => 1_000 })
    expect(cache.checkAndRecord('a', 100_000)).toBe(true)
    expect(cache.checkAndRecord('b', 100_000)).toBe(true)
    expect(cache.checkAndRecord('c', 100_000)).toBe(true) // evicts 'a'
    expect(cache.checkAndRecord('a', 100_000)).toBe(true) // 'a' gone -> fresh
    expect(cache.checkAndRecord('b', 100_000)).toBe(false) // 'b' still present
  })
})
