import { describe, expect, test, vi } from 'vitest'
import { createServerBridge } from '../src/index.js'

describe('session limits (C-08)', () => {
  test('rejects session creation when maxSessions is reached', async () => {
    const bridge = createServerBridge({ maxSessions: 2 })

    // Create 2 sessions (the limit)
    const res1 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
    expect(res1.status).toBe(200)
    const { id: id1 } = await res1.json()
    expect(id1).toBeDefined()

    const res2 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
    expect(res2.status).toBe(200)

    // Third session should be rejected
    const res3 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
    expect(res3.status).toBe(503)
    const body = await res3.json()
    expect(body.error).toMatch(/session limit/i)
  })

  test('cleans up expired sessions after sessionTimeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 2,
        sessionTimeoutMs: 1000,
      })

      // Create a session
      const res1 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
      expect(res1.status).toBe(200)

      // Advance past timeout
      vi.advanceTimersByTime(1500)

      // Session should have been cleaned up; we can create new ones
      const res2 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
      expect(res2.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  test('session access refreshes its timeout', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 1,
        sessionTimeoutMs: 1000,
      })

      // Create a session
      const res1 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
      const { id } = await res1.json()

      // Advance partway (800ms)
      vi.advanceTimersByTime(800)

      // Access the session with SSE connect -- refreshes timeout
      const controller = new AbortController()
      const sseRes = await bridge.handleRequest(
        new Request(`http://localhost/?id=${id}`, {
          method: 'GET',
          signal: controller.signal,
        }),
      )
      expect(sseRes.status).toBe(200)

      // Advance another 800ms (total 1600ms from creation, but only 800ms since refresh)
      vi.advanceTimersByTime(800)

      // Should NOT be cleaned up yet (refreshed at 800ms, so expires at 1800ms)
      // Try to create a second -- should fail because maxSessions=1 and session is still alive
      const res3 = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
      expect(res3.status).toBe(503)

      controller.abort()
    } finally {
      vi.useRealTimers()
    }
  })

  test('defaults to 1000 maxSessions and 300000ms sessionTimeoutMs', async () => {
    // Just verify it doesn't reject immediately -- defaults should be generous
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(new Request('http://localhost/', { method: 'GET' }))
    expect(res.status).toBe(200)
  })
})
