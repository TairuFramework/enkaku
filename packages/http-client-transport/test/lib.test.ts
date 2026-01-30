import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { ResponseError, createTransportStream } from '../src/index.js'

describe('ResponseError', () => {
  test('stores the response object', () => {
    const response = new Response('Not Found', { status: 404, statusText: 'Not Found' })
    const error = new ResponseError(response)
    expect(error.response).toBe(response)
    expect(error.message).toBe('Transport request failed with status 404 (Not Found)')
  })

  test('is an instance of Error', () => {
    const response = new Response('', { status: 500, statusText: 'Internal Server Error' })
    const error = new ResponseError(response)
    expect(error).toBeInstanceOf(Error)
  })
})

// Minimal protocol for testing
const protocol = {
  'test/event': { type: 'event', data: { type: 'string' } },
  'test/request': { type: 'request', result: { type: 'string' } },
  'test/stream': { type: 'stream', result: { type: 'string' } },
  'test/channel': { type: 'channel', data: { type: 'string' }, result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('createTransportStream()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('sends event messages via POST and handles 204 response', async () => {
    const requests: Array<{ url: string; body: string; headers: Record<string, string> }> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        url: req.url,
        body: await req.text(),
        headers: Object.fromEntries(req.headers.entries()),
      })
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const eventMsg = { payload: { typ: 'event', prc: 'test/event', data: 'hello' } } as any
    await writer.write(eventMsg)

    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('http://localhost/rpc')
    expect(JSON.parse(requests[0].body)).toEqual(eventMsg)
    // No enkaku-session-id header for events
    expect(requests[0].headers['enkaku-session-id']).toBeUndefined()

    await writer.close()
  })

  test('sends request messages via POST and enqueues response', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'world' } }

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const requestMsg = { payload: { typ: 'request', prc: 'test/request' } } as any
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(responsePayload)

    await writer.close()
  })

  test('errors the readable stream when POST returns non-ok response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const requestMsg = { payload: { typ: 'request', prc: 'test/request' } } as any
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    await expect(reader.read()).rejects.toThrow(
      'Transport request failed with status 500 (Internal Server Error)',
    )
  })
})
