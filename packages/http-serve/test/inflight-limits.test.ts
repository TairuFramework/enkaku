import { describe, expect, test, vi } from 'vitest'
import { createServerBridge } from '../src/index.js'

function createPostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('inflight request limits (C-09)', () => {
  test('rejects requests when maxInflightRequests is reached', async () => {
    const bridge = createServerBridge({ maxInflightRequests: 1 })

    // First request — will hang because no handler resolves it
    const _promise1 = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )

    // Second request should be rejected immediately
    const res2 = await bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r2', prc: 'test' } }),
    )
    expect(res2.status).toBe(503)
    const body = await res2.json()
    expect(body.error).toMatch(/inflight.*limit/i)

    // Fire-and-forget types should still work
    const res3 = await bridge.handleRequest(
      createPostRequest({ payload: { typ: 'event', prc: 'test' } }),
    )
    expect(res3.status).toBe(204)
  })

  test('cleans up expired inflight requests after requestTimeoutMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({
        maxInflightRequests: 1,
        requestTimeoutMs: 1000,
      })

      // Send a request — will hang
      const promise = bridge.handleRequest(
        createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
      )

      // Advance past timeout (async variant flushes microtasks between ticks,
      // ensuring the setTimeout inside handlePostRequest has been registered)
      await vi.advanceTimersByTimeAsync(1500)

      // The timed-out request should resolve with 504
      const res = await promise
      expect(res.status).toBe(504)
      const body = await res.json()
      expect(body.error).toMatch(/timeout/i)

      // Now a new request should be accepted
      const _promise2 = bridge.handleRequest(
        createPostRequest({ payload: { typ: 'request', rid: 'r2', prc: 'test' } }),
      )
      // Let the async handleRequest settle so r2 is registered in the inflight map
      await vi.advanceTimersByTimeAsync(0)

      // Shouldn't immediately reject — it was accepted
      const res3 = await bridge.handleRequest(
        createPostRequest({ payload: { typ: 'request', rid: 'r3', prc: 'test' } }),
      )
      expect(res3.status).toBe(503) // limit is 1, r2 is still pending
    } finally {
      vi.useRealTimers()
    }
  })

  test('defaults allow generous limits', async () => {
    const bridge = createServerBridge()
    // Should not reject a single request
    const promise = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )
    // Just verify it didn't immediately return a 503
    // (it will hang forever since no handler; that's expected)
    const raceResult = await Promise.race([
      promise.then((r) => r.status),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(raceResult).toBe('pending')
  })
})

describe('inflight stream entries are released', () => {
  test('stream rid is released when its result is written', async () => {
    const bridge = createServerBridge({ maxInflightRequests: 1 })
    const writer = bridge.stream.writable.getWriter()

    // Stream message creates an SSE session and occupies the only inflight slot
    const sseResponse = await bridge.handleRequest(
      createPostRequest({ payload: { typ: 'stream', rid: 's1', prc: 'test' } }),
    )
    expect(sseResponse.status).toBe(200)

    // Terminal result for s1 must release the inflight slot
    await writer.write({ payload: { typ: 'result', rid: 's1', val: 'done' } } as never)

    // A new request must NOT hit the inflight limit (pre-fix: immediate 503)
    const requestPromise = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )
    const raceResult = await Promise.race([
      requestPromise.then((r) => r.status),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(raceResult).toBe('pending')

    // Settle the pending request cleanly
    await writer.write({ payload: { typ: 'result', rid: 'r1', val: 'ok' } } as never)
    const res = await requestPromise
    expect(res.status).toBe(200)
  })

  test('session teardown sweeps its inflight stream entries', async () => {
    const bridge = createServerBridge({ maxInflightRequests: 1 })
    const abortController = new AbortController()
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { typ: 'stream', rid: 's1', prc: 'test' } }),
      signal: abortController.signal,
    })
    const sseResponse = await bridge.handleRequest(request)
    expect(sseResponse.status).toBe(200)

    // Client disconnects the SSE request — the session and its rids must be swept
    abortController.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    const requestPromise = bridge.handleRequest(
      createPostRequest({ payload: { typ: 'request', rid: 'r1', prc: 'test' } }),
    )
    const raceResult = await Promise.race([
      requestPromise.then((r) => r.status),
      new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 50)),
    ])
    expect(raceResult).toBe('pending')
  })
})
