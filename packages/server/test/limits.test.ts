import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createResourceLimiter, DEFAULT_RESOURCE_LIMITS } from '../src/limits.js'

describe('ResourceLimits', () => {
  test('DEFAULT_RESOURCE_LIMITS has expected values', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxControllers).toBe(10000)
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentHandlers).toBe(100)
    expect(DEFAULT_RESOURCE_LIMITS.controllerTimeoutMs).toBe(300000) // 5 min
    expect(DEFAULT_RESOURCE_LIMITS.cleanupTimeoutMs).toBe(30000) // 30 sec
    expect(DEFAULT_RESOURCE_LIMITS.maxMessageSize).toBe(10485760) // 10 MB
  })

  test('createResourceLimiter returns limiter with defaults', () => {
    const limiter = createResourceLimiter()
    expect(limiter.limits).toEqual(DEFAULT_RESOURCE_LIMITS)
  })

  test('createResourceLimiter merges partial options', () => {
    const limiter = createResourceLimiter({ maxControllers: 500 })
    expect(limiter.limits.maxControllers).toBe(500)
    expect(limiter.limits.maxConcurrentHandlers).toBe(100) // default preserved
  })
})

describe('ResourceLimiter controller tracking', () => {
  test('canAddController returns true when under limit', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    expect(limiter.canAddController()).toBe(true)
  })

  test('addController increments count', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    expect(limiter.controllerCount).toBe(0)
    limiter.addController('rid1')
    expect(limiter.controllerCount).toBe(1)
  })

  test('canAddController returns false at limit', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    limiter.addController('rid1')
    limiter.addController('rid2')
    expect(limiter.canAddController()).toBe(false)
  })

  test('removeController decrements count', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    limiter.addController('rid1')
    limiter.addController('rid2')
    expect(limiter.controllerCount).toBe(2)
    limiter.removeController('rid1')
    expect(limiter.controllerCount).toBe(1)
    expect(limiter.canAddController()).toBe(true)
  })

  test('removeController is idempotent for unknown rid', () => {
    const limiter = createResourceLimiter({ maxControllers: 2 })
    limiter.addController('rid1')
    limiter.removeController('unknown')
    expect(limiter.controllerCount).toBe(1)
  })
})

describe('ResourceLimiter controller timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('getExpiredControllers returns empty when none expired', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('rid1')
    expect(limiter.getExpiredControllers()).toEqual([])
  })

  test('getExpiredControllers returns expired controllers', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('rid1')
    vi.advanceTimersByTime(500)
    limiter.addController('rid2')
    vi.advanceTimersByTime(600)
    // rid1 is now 1100ms old (expired), rid2 is 600ms old (not expired)
    const expired = limiter.getExpiredControllers()
    expect(expired).toEqual(['rid1'])
  })

  test('removeController clears timeout tracking', () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 1000 })
    limiter.addController('rid1')
    limiter.removeController('rid1')
    vi.advanceTimersByTime(2000)
    expect(limiter.getExpiredControllers()).toEqual([])
  })
})

describe('ResourceLimiter handler concurrency', () => {
  test('acquireHandler returns true when under limit', () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    expect(limiter.acquireHandler()).toBe(true)
    expect(limiter.activeHandlers).toBe(1)
  })

  test('acquireHandler returns false at limit', () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    limiter.acquireHandler()
    limiter.acquireHandler()
    expect(limiter.acquireHandler()).toBe(false)
    expect(limiter.activeHandlers).toBe(2)
  })

  test('releaseHandler decrements count', () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    limiter.acquireHandler()
    limiter.acquireHandler()
    limiter.releaseHandler()
    expect(limiter.activeHandlers).toBe(1)
    expect(limiter.acquireHandler()).toBe(true)
  })

  test('releaseHandler does not go negative', () => {
    const limiter = createResourceLimiter({ maxConcurrentHandlers: 2 })
    limiter.releaseHandler()
    expect(limiter.activeHandlers).toBe(0)
  })
})
