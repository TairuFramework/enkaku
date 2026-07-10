import { describe, expect, test } from 'vitest'

import { createServerBridge } from '../src/index.js'

function createRequestPost(rid: string): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { typ: 'request', rid, prc: 'test/request' } }),
  })
}

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

describe('duplicate request IDs', () => {
  test('a second in-flight request with the same rid gets 409', async () => {
    const bridge = createServerBridge()

    // First request never gets a reply — it stays in flight.
    void bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    const res = await bridge.handleRequest(createRequestPost('r1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/duplicate request id/i)
  })

  test('a stream reusing an in-flight rid gets 409', async () => {
    const bridge = createServerBridge()

    const res1 = await bridge.handleRequest(createStreamPost('r1'))
    expect(res1.status).toBe(200)
    const sessionID = res1.headers.get('enkaku-session-id') as string

    const res2 = await bridge.handleRequest(createStreamPost('r1', sessionID))
    expect(res2.status).toBe(409)
  })

  test('a released rid can be reused', async () => {
    const bridge = createServerBridge()

    // First request, replied to with a 'first' result — this must delete the
    // inflight entry for 'r1', releasing it for reuse.
    const firstCall = bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    const writer = bridge.stream.writable.getWriter()
    await writer.write({ payload: { typ: 'result', rid: 'r1', val: 'first' } } as never)
    writer.releaseLock()

    const firstRes = await firstCall
    expect(firstRes.status).toBe(200)
    const firstBody = await firstRes.json()
    expect(firstBody.payload.val).toBe('first')

    // Second request reusing the now-released rid must be ACCEPTED (not 409)
    // and must receive its own distinct reply, not the first call's stale one.
    const secondCall = bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    const writer2 = bridge.stream.writable.getWriter()
    await writer2.write({ payload: { typ: 'result', rid: 'r1', val: 'second' } } as never)
    writer2.releaseLock()

    const secondRes = await secondCall
    expect(secondRes.status).toBe(200)
    const secondBody = await secondRes.json()
    expect(secondBody.payload.val).toBe('second')
  })
})
