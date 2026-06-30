import { ErrorCodes } from '@enkaku/protocol'
import type { SignedToken } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import { checkReplay, MemoryReplayCache, resolveReplay } from '../src/replay.js'

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
    expect(cache.checkAndRecord('b', 100_000)).toBe(false) // 'b' present -> replay
    expect(cache.checkAndRecord('c', 100_000)).toBe(true) // over cap -> evicts oldest 'a'
    expect(cache.checkAndRecord('a', 100_000)).toBe(true) // 'a' was evicted -> fresh
  })
})

function makeMessage(payload: {
  iss?: string
  jti?: string
  exp?: number
  iat?: number
  signature?: string
}): SignedToken {
  return {
    data: 'x',
    header: {} as SignedToken['header'],
    payload: {
      iss: payload.iss ?? 'did:key:alice',
      jti: payload.jti,
      exp: payload.exp,
      iat: payload.iat,
    } as SignedToken['payload'],
    signature: payload.signature ?? 'sig-default',
  }
}

describe('resolveReplay', () => {
  test('returns null when auth is not required', () => {
    expect(resolveReplay(undefined, false)).toBeNull()
  })

  test('returns null when explicitly disabled', () => {
    expect(resolveReplay({ enabled: false }, true)).toBeNull()
  })

  test('fills defaults when enabled', () => {
    const resolved = resolveReplay(undefined, true)
    expect(resolved).not.toBeNull()
    expect(resolved?.maxAge).toBe(60_000)
    expect(resolved?.rejectStale).toBe(true)
    expect(resolved?.cache).toBeDefined()
  })
})

describe('checkReplay', () => {
  const base = { now: () => 1_000_000, exp: 2_000 } // exp seconds -> 2_000_000 ms > now

  test('accepts a fresh message and rejects its replay', async () => {
    const resolved = resolveReplay({ now: base.now }, true)!
    const message = makeMessage({ jti: 'j1', exp: base.exp })
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_detected',
    })
  })

  test('keys on signature when jti is absent', async () => {
    const resolved = resolveReplay({ now: base.now }, true)!
    const a = makeMessage({ exp: base.exp, signature: 'sig-A' })
    const b = makeMessage({ exp: base.exp, signature: 'sig-B' })
    expect(await checkReplay(a, resolved)).toEqual({ ok: true })
    expect(await checkReplay(a, resolved)).toEqual({ ok: false, reason: 'replay_detected' })
    expect(await checkReplay(b, resolved)).toEqual({ ok: true })
  })

  test('rejects a message whose exp is in the past', async () => {
    const resolved = resolveReplay({ now: () => 5_000_000 }, true)!
    const message = makeMessage({ jti: 'j2', exp: 2_000 }) // 2_000_000 ms < now
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_stale',
    })
  })

  test('rejects a message older than maxAge when it has no exp', async () => {
    const resolved = resolveReplay({ now: () => 1_000_000, maxAge: 60_000 }, true)!
    const message = makeMessage({ jti: 'j3', iat: 900 }) // 900_000 ms; +60s = 960_000 < now
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_stale',
    })
  })

  test('accepts a stale message when rejectStale is false', async () => {
    const resolved = resolveReplay({ now: () => 1_000_000, rejectStale: false }, true)!
    const message = makeMessage({ jti: 'j4', iat: 900 })
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
  })

  test('accepts again once the cache entry has expired', async () => {
    let now = 1_000_000
    const resolved = resolveReplay({ now: () => now }, true)!
    const message = makeMessage({ jti: 'j5', exp: 1_500 }) // expiresAt 1_500_000 ms
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
    now = 1_600_000 // past expiresAt; also past exp, but rejectStale default would block — disable
    const resolvedNoStale = resolveReplay(
      { now: () => now, rejectStale: false, cache: resolved.cache },
      true,
    )!
    expect(await checkReplay(message, resolvedNoStale)).toEqual({ ok: true })
  })

  test('REPLAY_DETECTED error code is EK09', () => {
    expect(ErrorCodes.REPLAY_DETECTED).toBe('EK09')
  })
})
