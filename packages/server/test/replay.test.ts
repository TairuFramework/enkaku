import { ErrorCodes } from '@enkaku/protocol'
import type { SignedToken } from '@kokuin/token'
import { describe, expect, test } from 'vitest'

import {
  checkReplay,
  MemoryReplayCache,
  type ReplayOptions,
  type ResolvedReplay,
  resolveReplay,
} from '../src/replay.js'

// Test helper: resolveReplay returns `ResolvedReplay | null`; every call below
// requires auth and leaves replay enabled, so the result is never null.
function resolveOrThrow(options: ReplayOptions): ResolvedReplay {
  const resolved = resolveReplay(options, true)
  if (resolved == null) {
    throw new Error('expected resolveReplay to return a resolved config')
  }
  return resolved
}

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
    const resolved = resolveOrThrow({ now: base.now })
    const message = makeMessage({ jti: 'j1', exp: base.exp })
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_detected',
    })
  })

  test('keys on signature when jti is absent', async () => {
    const resolved = resolveOrThrow({ now: base.now })
    const a = makeMessage({ exp: base.exp, signature: 'sig-A' })
    const b = makeMessage({ exp: base.exp, signature: 'sig-B' })
    expect(await checkReplay(a, resolved)).toEqual({ ok: true })
    expect(await checkReplay(a, resolved)).toEqual({ ok: false, reason: 'replay_detected' })
    expect(await checkReplay(b, resolved)).toEqual({ ok: true })
  })

  test('rejects a message whose exp is in the past', async () => {
    const resolved = resolveOrThrow({ now: () => 5_000_000 })
    const message = makeMessage({ jti: 'j2', exp: 2_000 }) // 2_000_000 ms < now
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_stale',
    })
  })

  test('rejects a message older than maxAge when it has no exp', async () => {
    const resolved = resolveOrThrow({ now: () => 1_000_000, maxAge: 60_000 })
    const message = makeMessage({ jti: 'j3', iat: 900 }) // 900_000 ms; +60s = 960_000 < now
    expect(await checkReplay(message, resolved)).toEqual({
      ok: false,
      reason: 'replay_stale',
    })
  })

  test('accepts a stale message when rejectStale is false', async () => {
    const resolved = resolveOrThrow({ now: () => 1_000_000, rejectStale: false })
    const message = makeMessage({ jti: 'j4', iat: 900 })
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
  })

  test('accepts again once the cache entry has expired', async () => {
    let now = 1_000_000
    const resolved = resolveOrThrow({ now: () => now })
    const message = makeMessage({ jti: 'j5', exp: 1_500 }) // expiresAt 1_500_000 ms
    expect(await checkReplay(message, resolved)).toEqual({ ok: true })
    now = 1_600_000 // past expiresAt; also past exp, but rejectStale default would block — disable
    const resolvedNoStale = resolveOrThrow({
      now: () => now,
      rejectStale: false,
      cache: resolved.cache,
    })
    expect(await checkReplay(message, resolvedNoStale)).toEqual({ ok: true })
  })

  test('REPLAY_DETECTED error code is EK09', () => {
    expect(ErrorCodes.REPLAY_DETECTED).toBe('EK09')
  })
})

describe('clock-skew leeway', () => {
  function signed(payload: Record<string, unknown>): SignedToken {
    return { payload: { iss: 'did:key:zTest', ...payload }, signature: 'sig' } as SignedToken
  }

  test('iat within maxAge + leeway passes', async () => {
    const now = 100_000
    const resolved = resolveOrThrow({ maxAge: 10_000, leeway: 5_000, now: () => now })
    // iat 12s ago: past maxAge (10s) but within maxAge + leeway (15s)
    const result = await checkReplay(signed({ jti: 'a', iat: (now - 12_000) / 1000 }), resolved)
    expect(result).toEqual({ ok: true })
  })

  test('iat beyond maxAge + leeway is stale', async () => {
    const now = 100_000
    const resolved = resolveOrThrow({ maxAge: 10_000, leeway: 5_000, now: () => now })
    const result = await checkReplay(signed({ jti: 'b', iat: (now - 16_000) / 1000 }), resolved)
    expect(result).toEqual({ ok: false, reason: 'replay_stale' })
  })

  test('exp within leeway passes', async () => {
    const now = 100_000
    const resolved = resolveOrThrow({ leeway: 5_000, now: () => now })
    const result = await checkReplay(signed({ jti: 'c', exp: (now - 3_000) / 1000 }), resolved)
    expect(result).toEqual({ ok: true })
  })

  test('recorded entry lives through the leeway tail (no replay slip)', async () => {
    let now = 100_000
    const cache = new MemoryReplayCache({ now: () => now })
    const resolved = resolveOrThrow({ maxAge: 10_000, leeway: 5_000, cache, now: () => now })
    const msg = signed({ jti: 'd', iat: now / 1000 })
    expect(await checkReplay(msg, resolved)).toEqual({ ok: true })
    now = 100_000 + 12_000 // past maxAge, within maxAge + leeway
    // staleness still accepts it, and the cache must still hold the key -> replay
    expect(await checkReplay(msg, resolved)).toEqual({ ok: false, reason: 'replay_detected' })
  })

  test('distinct jti on byte-identical intent both pass (regression for #1)', async () => {
    const resolved = resolveOrThrow({ now: () => 100_000 })
    const a = signed({ jti: 'unique-1', iat: 100 })
    const b = signed({ jti: 'unique-2', iat: 100 })
    expect(await checkReplay(a, resolved)).toEqual({ ok: true })
    expect(await checkReplay(b, resolved)).toEqual({ ok: true })
  })
})
