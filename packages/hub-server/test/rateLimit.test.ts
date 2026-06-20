import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createRateLimiter } from '../src/rateLimit.js'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('allows up to burst then rejects', () => {
    const limiter = createRateLimiter({ rate: 1, burst: 3 })
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
  })

  test('refills over time at the configured rate', () => {
    const limiter = createRateLimiter({ rate: 2, burst: 2 })
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
    // After 1s, rate=2 refills 2 tokens (capped at burst).
    vi.advanceTimersByTime(1000)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
  })

  test('keys are independent', () => {
    const limiter = createRateLimiter({ rate: 1, burst: 1 })
    expect(limiter.tryConsume('a')).toBe(true)
    expect(limiter.tryConsume('a')).toBe(false)
    expect(limiter.tryConsume('b')).toBe(true)
  })
})
