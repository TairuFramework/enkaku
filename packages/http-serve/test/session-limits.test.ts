import { describe, expect, test, vi } from 'vitest'
import { createServerBridge } from '../src/index.js'

function createStreamPost(rid: string, sessionID?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sessionID != null) {
    headers['enkaku-session-id'] = sessionID
  }
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('session limits', () => {
  test('rejects session creation when maxSessions is reached', async () => {
    const bridge = createServerBridge({ maxSessions: 1 })

    // First POST creates session
    const res1 = await bridge.handleRequest(createStreamPost('r1'))
    expect(res1.status).toBe(200)
    expect(res1.headers.get('enkaku-session-id')).toBeTruthy()

    // Second POST without session ID tries to create new session — rejected
    const res2 = await bridge.handleRequest(createStreamPost('r2'))
    expect(res2.status).toBe(503)
    const body = await res2.json()
    expect(body.error).toMatch(/session limit/i)
  })

  test('cleans up expired sessions after sessionTimeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 1,
        sessionTimeoutMs: 1000,
      })

      // Create a session
      const res1 = await bridge.handleRequest(createStreamPost('r1'))
      expect(res1.status).toBe(200)

      // Advance past timeout — cleanup interval fires at multiples of sessionTimeoutMs (1000ms),
      // and session expires when now - lastAccess > sessionTimeoutMs, so we need to reach t=2000
      vi.advanceTimersByTime(2500)

      // Session should have been cleaned up; new session accepted
      const res2 = await bridge.handleRequest(createStreamPost('r2'))
      expect(res2.status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  test('session access via POST refreshes its timeout', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxSessions: 1,
        sessionTimeoutMs: 1000,
      })

      // Create session
      const res1 = await bridge.handleRequest(createStreamPost('r1'))
      const sessionID = res1.headers.get('enkaku-session-id') as string

      // Advance partway (800ms)
      vi.advanceTimersByTime(800)

      // Access session with another stream POST — refreshes timeout
      const res2 = await bridge.handleRequest(createStreamPost('r2', sessionID))
      expect(res2.status).toBe(204)

      // Advance another 800ms (1600ms total, but only 800ms since refresh)
      vi.advanceTimersByTime(800)

      // Should NOT be cleaned up yet — try to create new session, should fail
      const res3 = await bridge.handleRequest(createStreamPost('r3'))
      expect(res3.status).toBe(503)
    } finally {
      vi.useRealTimers()
    }
  })

  test('defaults to generous limits', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(createStreamPost('r1'))
    expect(res.status).toBe(200)
  })
})
