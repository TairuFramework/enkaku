import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createEventStream, createTransportStream, ResponseError } from '../src/index.js'

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
type ClientMessage = AnyClientMessageOf<Protocol>

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
    const eventMsg = {
      payload: { typ: 'event', prc: 'test/event', data: 'hello' },
    } as unknown as ClientMessage
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
    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
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
    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
    await writer.write(requestMsg)

    const reader = stream.readable.getReader()
    await expect(reader.read()).rejects.toThrow(
      'Transport request failed with status 500 (Internal Server Error)',
    )
  })
})

describe('createEventStream()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('throws ResponseError when fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' })
    }) as typeof fetch

    await expect(createEventStream('http://localhost/rpc')).rejects.toThrow(
      'Transport request failed with status 404',
    )
  })
})

describe('createTransportStream() SSE session handling', () => {
  let originalFetch: typeof globalThis.fetch
  let originalEventSource: typeof globalThis.EventSource

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalEventSource = globalThis.EventSource
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEventSource
  })

  test('channel messages include enkaku-session-id header', async () => {
    const requests: Array<{ headers: Record<string, string> }> = []
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        headers: Object.fromEntries(req.headers.entries()),
      })

      // First fetch is the SSE setup GET request
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify({ id: 'session-123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      // Subsequent fetches are POST requests
      return new Response(null, { status: 204 })
    }) as typeof fetch

    // Mock EventSource using a class so it can be used with `new`
    const mockClose = vi.fn()
    const mockAddEventListener = vi.fn()
    globalThis.EventSource = class MockEventSource {
      addEventListener = mockAddEventListener
      close = mockClose
    } as unknown as typeof EventSource

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const channelMsg = {
      payload: { typ: 'channel', prc: 'test/channel', data: 'init' },
    } as unknown as ClientMessage
    await writer.write(channelMsg)

    // Should have made 2 fetch calls: GET for session + POST for message
    expect(fetchCallCount).toBe(2)
    // The POST request should include the session ID header
    expect(requests[1].headers['enkaku-session-id']).toBe('session-123')

    await writer.close()
  })

  test('stream messages trigger SSE connection', async () => {
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify({ id: 'session-456' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(null, { status: 204 })
    }) as typeof fetch

    globalThis.EventSource = class MockEventSource {
      addEventListener = vi.fn()
      close = vi.fn()
    } as unknown as typeof EventSource

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    // SSE setup GET + message POST
    expect(fetchCallCount).toBe(2)

    await writer.close()
  })

  test('disposes SSE source on writable close', async () => {
    const mockClose = vi.fn()

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ id: 'session-789' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    globalThis.EventSource = class MockEventSource {
      addEventListener = vi.fn()
      close = mockClose
    } as unknown as typeof EventSource

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const channelMsg = {
      payload: { typ: 'channel', prc: 'test/channel', data: 'init' },
    } as unknown as ClientMessage
    await writer.write(channelMsg)

    // Wait for SSE connection to be established
    await new Promise((resolve) => setTimeout(resolve, 10))

    await writer.close()
    expect(mockClose).toHaveBeenCalled()
  })
})

describe('createTransportStream() SSE message reception', () => {
  let originalFetch: typeof globalThis.fetch
  let originalEventSource: typeof globalThis.EventSource

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalEventSource = globalThis.EventSource
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.EventSource = originalEventSource
  })

  test('enqueues SSE messages to readable stream', async () => {
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async () => {
      fetchCallCount++
      // First fetch is the SSE setup GET request
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify({ id: 'sse-test' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      // Subsequent fetches are POST requests — return 204 so no response body is enqueued
      return new Response(null, { status: 204 })
    }) as typeof fetch

    type EventHandler = (event: { data: string }) => void
    const listeners: Record<string, Array<EventHandler>> = {}
    globalThis.EventSource = class MockEventSource {
      addEventListener(type: string, handler: EventHandler) {
        if (listeners[type] == null) {
          listeners[type] = []
        }
        listeners[type].push(handler)
      }
      close = vi.fn()
    } as unknown as typeof EventSource

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    // Trigger SSE connection by sending a channel message
    const writer = stream.writable.getWriter()
    const channelMsg = {
      payload: { typ: 'channel', prc: 'test/channel', data: 'init' },
    } as unknown as ClientMessage
    await writer.write(channelMsg)

    // Wait for the SSE connection promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Simulate SSE message from server
    const serverMsg = { payload: { typ: 'result', val: 'sse-data' } }
    for (const handler of listeners.message ?? []) {
      handler({ data: JSON.stringify(serverMsg) })
    }

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(serverMsg)

    await writer.close()
  })
})

describe('ClientTransport', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('creates a transport that sends messages via HTTP', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'ok' } }

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const { ClientTransport } = await import('../src/index.js')
    const transport = new ClientTransport<Protocol>({ url: 'http://localhost/rpc' })

    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
    await transport.write(requestMsg)

    const result = await transport.read()
    expect(result.value).toEqual(responsePayload)

    await transport.dispose()
  })
})
