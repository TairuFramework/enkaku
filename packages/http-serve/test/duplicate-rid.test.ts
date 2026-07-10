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

    void bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Server replies, which deletes the inflight entry.
    const writer = bridge.stream.writable.getWriter()
    await writer.write({ payload: { typ: 'result', rid: 'r1', val: 'ok' } } as never)
    writer.releaseLock()
    await new Promise((resolve) => setTimeout(resolve, 10))

    void bridge.handleRequest(createRequestPost('r1'))
    await new Promise((resolve) => setTimeout(resolve, 10))

    // The second one is now the in-flight holder; a third is refused.
    const res = await bridge.handleRequest(createRequestPost('r1'))
    expect(res.status).toBe(409)
  })
})
