import { describe, expect, test } from 'vitest'
import { createServerBridge } from '../src/index.js'

describe('request body size limits', () => {
  test('rejects a body over maxRequestBodySize with 413 (content-length fast path)', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 100 })
    const body = JSON.stringify({ payload: { typ: 'event', prc: 'test', data: 'x'.repeat(500) } })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(new TextEncoder().encode(body).byteLength),
        },
        body,
      }),
    )
    expect(res.status).toBe(413)
    const json = await res.json()
    expect(json.error).toMatch(/too large/i)
  })

  test('rejects an oversized streamed body with no content-length (robust path)', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 100 })
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(500)))
        controller.close()
      },
    })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: stream,
        // undici requires duplex: 'half' for a streaming request body; the field
        // is not in every TS lib.dom version, so widen the init type locally.
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    )
    expect(res.status).toBe(413)
  })

  test('returns 400 for a malformed JSON body within the size cap', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 10_000 })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not valid json',
      }),
    )
    expect(res.status).toBe(400)
  })

  test('accepts a body under the cap', async () => {
    const bridge = createServerBridge({ maxRequestBodySize: 10_000 })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload: { typ: 'event', prc: 'test' } }),
      }),
    )
    expect(res.status).toBe(204)
  })

  test('applies a 1 MiB default when maxRequestBodySize is unset', async () => {
    const bridge = createServerBridge()
    const body = JSON.stringify({
      payload: { typ: 'event', prc: 'test', data: 'x'.repeat(2_000_000) },
    })
    const res = await bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
    )
    expect(res.status).toBe(413)
  })
})
