import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createTransportStream, ResponseError } from '../src/index.js'

// Minimal protocol for testing
const protocol = {
  'test/event': { type: 'event', data: { type: 'object' } },
  'test/request': { type: 'request', result: { type: 'string' } },
  'test/stream': { type: 'stream', receive: { type: 'string' }, result: { type: 'string' } },
  'test/channel': {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol
type ClientMessage = AnyClientMessageOf<Protocol>

function createSSEResponse(
  sessionID: string,
  events: Array<Record<string, unknown>> = [],
): Response {
  const chunks = [':\n\n']
  for (const event of events) {
    chunks.push(`data: ${JSON.stringify(event)}\n\n`)
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      if (events.length > 0) {
        controller.close()
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'enkaku-session-id': sessionID,
    },
  })
}

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

  test('uses custom fetch function when provided', async () => {
    const globalFetchSpy = vi.fn()
    globalThis.fetch = globalFetchSpy as typeof fetch

    const customFetch = vi.fn(async () => {
      return new Response(null, { status: 204 })
    }) as unknown as typeof fetch

    const stream = createTransportStream<Protocol>({
      url: 'http://localhost/rpc',
      fetch: customFetch,
    })

    const writer = stream.writable.getWriter()
    const eventMsg = {
      payload: { typ: 'event', prc: 'test/event', data: 'hello' },
    } as unknown as ClientMessage
    await writer.write(eventMsg)

    expect(customFetch).toHaveBeenCalledTimes(1)
    expect(globalFetchSpy).not.toHaveBeenCalled()

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

describe('createTransportStream() SSE session handling', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('first stream message creates SSE session via POST', async () => {
    const requests: Array<{
      method: string
      body: string
      headers: Record<string, string>
    }> = []
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        method: req.method,
        body: await req.text(),
        headers: Object.fromEntries(req.headers.entries()),
      })

      // First fetch is the SSE-creating POST (stream/channel with accept: text/event-stream)
      if (fetchCallCount === 1) {
        return createSSEResponse('session-123')
      }
      // Subsequent fetches are normal POSTs
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    // Should have made 1 fetch call: POST that creates SSE session (message is sent in the body)
    expect(fetchCallCount).toBe(1)
    // The request should be a POST (not GET)
    expect(requests[0].method).toBe('POST')
    // The request should include accept: text/event-stream
    expect(requests[0].headers.accept).toBe('text/event-stream')

    await writer.close()
  })

  test('subsequent stream messages include enkaku-session-id header', async () => {
    const requests: Array<{ headers: Record<string, string> }> = []
    let fetchCallCount = 0

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++
      const req = input instanceof Request ? input : new Request(input, init)
      requests.push({
        headers: Object.fromEntries(req.headers.entries()),
      })

      // First POST creates the SSE session
      if (fetchCallCount === 1) {
        return createSSEResponse('session-456')
      }
      // Subsequent POSTs
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    // First message creates the session
    const streamMsg1 = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg1)

    // Second message should include the session ID
    const streamMsg2 = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg2)

    expect(fetchCallCount).toBe(2)
    // Second POST should include session ID header
    expect(requests[1].headers['enkaku-session-id']).toBe('session-456')

    await writer.close()
  })

  test('channel and stream share the same SSE session', async () => {
    let fetchCallCount = 0
    const sessionIDs: Array<string | undefined> = []

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      fetchCallCount++
      const req = input instanceof Request ? input : new Request(input, init)
      sessionIDs.push(req.headers.get('enkaku-session-id') ?? undefined)

      if (fetchCallCount === 1) {
        return createSSEResponse('shared-session')
      }
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    // First: channel message creates the session
    const channelMsg = {
      payload: { typ: 'channel', prc: 'test/channel', data: 'init' },
    } as unknown as ClientMessage
    await writer.write(channelMsg)

    // Second: stream message should reuse the same session
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    expect(fetchCallCount).toBe(2)
    // First had no session ID (it created the session)
    expect(sessionIDs[0]).toBeUndefined()
    // Second should use the shared session
    expect(sessionIDs[1]).toBe('shared-session')

    await writer.close()
  })
})

describe('createTransportStream() SSE message reception', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('enqueues SSE messages to readable stream', async () => {
    const serverMsg = { payload: { typ: 'result', val: 'sse-data' } }

    globalThis.fetch = vi.fn(async () => {
      return createSSEResponse('sse-test', [serverMsg])
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    // Trigger SSE connection by sending a stream message
    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    // Wait for SSE messages to be parsed and enqueued
    await new Promise((resolve) => setTimeout(resolve, 50))

    const reader = stream.readable.getReader()
    const result = await reader.read()
    expect(result.value).toEqual(serverMsg)

    await writer.close()
  })
})

describe('createTransportStream() SSE disposal', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('abort signal fired on writable close', async () => {
    let abortSignal: AbortSignal | undefined

    globalThis.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.signal) {
        abortSignal = init.signal
      }
      return createSSEResponse('dispose-test')
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const channelMsg = {
      payload: { typ: 'channel', prc: 'test/channel', data: 'init' },
    } as unknown as ClientMessage
    await writer.write(channelMsg)

    expect(abortSignal).toBeDefined()
    expect(abortSignal?.aborted).toBe(false)

    await writer.close()
    expect(abortSignal?.aborted).toBe(true)
  })
})

describe('createTransportStream() null response body', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('errors readable stream when SSE response body is null', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(null, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
          'enkaku-session-id': 'null-body-test',
        },
      })
    }) as typeof fetch

    const stream = createTransportStream<Protocol>({ url: 'http://localhost/rpc' })

    const writer = stream.writable.getWriter()
    const streamMsg = {
      payload: { typ: 'stream', prc: 'test/stream' },
    } as unknown as ClientMessage
    await writer.write(streamMsg)

    // Wait for consumeSSEStream to process
    await new Promise((resolve) => setTimeout(resolve, 50))

    const reader = stream.readable.getReader()
    await expect(reader.read()).rejects.toThrow(
      'Response body is null — streaming may not be supported by this environment',
    )

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

  test('accepts custom fetch function', async () => {
    const responsePayload = { payload: { typ: 'result', val: 'custom' } }
    const globalFetchSpy = vi.fn()
    globalThis.fetch = globalFetchSpy as typeof fetch

    const customFetch = vi.fn(async () => {
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const { ClientTransport } = await import('../src/index.js')
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/rpc',
      fetch: customFetch,
    })

    const requestMsg = {
      payload: { typ: 'request', prc: 'test/request' },
    } as unknown as ClientMessage
    await transport.write(requestMsg)

    const result = await transport.read()
    expect(result.value).toEqual(responsePayload)
    expect(customFetch).toHaveBeenCalledTimes(1)
    expect(globalFetchSpy).not.toHaveBeenCalled()

    await transport.dispose()
  })
})
