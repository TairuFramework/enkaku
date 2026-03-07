import { setTimeout } from 'node:timers/promises'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { serve } from '@enkaku/server'
import { createUnsignedToken } from '@enkaku/token'
import { describe, expect, test, vi } from 'vitest'

import { createServerBridge, ServerTransport } from '../src/index.js'

describe('ServerTransport', () => {
  test('handles protocol messages', async () => {
    const protocol = {
      'test/event': {
        type: 'event',
        data: {
          type: 'object',
          properties: { hello: { type: 'string' } },
          required: ['hello'],
          additionalProperties: false,
        },
      },
      'test/request': {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const testEventHandler = vi.fn()
    const testRequestHandler = vi.fn(() => {
      return setTimeout(100, 'hello')
    })

    const handlers = {
      'test/event': testEventHandler,
      'test/request': testRequestHandler,
    }
    const transport = new ServerTransport<Protocol>()
    const server = serve<Protocol>({ handlers, accessControl: false, transport })

    const headers = new Headers()
    headers.set('content-type', 'application/json')

    const eventMessage = createUnsignedToken({
      typ: 'event',
      prc: 'test/event',
      data: { hello: 'world' },
    })
    await transport.fetch(
      new Request('http://localhost/test', {
        headers,
        body: JSON.stringify(eventMessage),
        method: 'POST',
      }),
    )
    await setTimeout(100)
    expect(testEventHandler).toHaveBeenCalledWith({
      data: { hello: 'world' },
      message: eventMessage,
    })

    const requestMessage = createUnsignedToken({ typ: 'request', prc: 'test/request' })
    const response = await transport.fetch(
      new Request('http://localhost/test', {
        headers,
        body: JSON.stringify(requestMessage),
        method: 'POST',
      }),
    )
    await expect(response.json()).resolves.toEqual(
      createUnsignedToken({ typ: 'result', val: 'hello' }),
    )

    await server.dispose()
  })

  test('errors on unsupported methods', async () => {
    const transport = new ServerTransport()
    const res = await transport.fetch(new Request('http://localhost/test', { method: 'HEAD' }))
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST, OPTIONS')
    await expect(res.json()).resolves.toEqual({ error: 'Method not allowed' })
  })

  describe('CORS support', () => {
    const protocol = {
      'test/request': {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    describe('handles OPTIONS requests', () => {
      test('rejects cross-origin when no allowedOrigin is configured (same-origin default)', async () => {
        const transport = new ServerTransport<Protocol>()
        const headers = new Headers()
        headers.set('origin', 'http://example.com')
        const res = await transport.fetch(
          new Request('http://localhost/test', { headers, method: 'OPTIONS' }),
        )
        expect(res.status).toBe(403)
      })

      test('from any origin (explicit "*")', async () => {
        const transport = new ServerTransport<Protocol>({ allowedOrigin: '*' })
        const headers = new Headers()
        headers.set('origin', 'http://example.com')
        const res = await transport.fetch(
          new Request('http://localhost/test', { headers, method: 'OPTIONS' }),
        )
        expect(res.status).toBe(204)
        expect(res.headers.get('access-control-allow-origin')).toBe('http://example.com')
        expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
        expect(res.headers.get('access-control-allow-headers')).toBe(
          'Content-Type, enkaku-session-id',
        )
        expect(res.headers.get('access-control-expose-headers')).toBe('enkaku-session-id')
        expect(res.headers.get('access-control-max-age')).toBe('86400')
      })

      test('from allowed origin', async () => {
        const transport = new ServerTransport<Protocol>({ allowedOrigin: 'http://example.com' })
        const headers = new Headers()
        headers.set('origin', 'http://example.com')
        const res = await transport.fetch(
          new Request('http://localhost/test', { headers, method: 'OPTIONS' }),
        )
        expect(res.status).toBe(204)
        expect(res.headers.get('access-control-allow-origin')).toBe('http://example.com')
        expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
        expect(res.headers.get('access-control-allow-headers')).toBe(
          'Content-Type, enkaku-session-id',
        )
        expect(res.headers.get('access-control-expose-headers')).toBe('enkaku-session-id')
        expect(res.headers.get('access-control-max-age')).toBe('86400')
      })

      test('rejects requests from disallowed origin', async () => {
        const transport = new ServerTransport<Protocol>({ allowedOrigin: 'http://example.com' })
        const headers = new Headers()
        headers.set('origin', 'http://other.com')
        const res = await transport.fetch(
          new Request('http://localhost/test', { headers, method: 'OPTIONS' }),
        )
        expect(res.status).toBe(403)
      })
    })

    test('handles POST requests', async () => {
      const testRequestHandler = vi.fn(() => {
        return setTimeout(100, 'hello')
      })

      const handlers = {
        'test/request': testRequestHandler,
      }
      const transport = new ServerTransport<Protocol>({ allowedOrigin: 'http://example.com' })
      const server = serve<Protocol>({ handlers, accessControl: false, transport })

      const headers = new Headers()
      headers.set('content-type', 'application/json')
      headers.set('origin', 'http://example.com')

      const requestMessage = createUnsignedToken({ typ: 'request', prc: 'test/request' })
      const response = await transport.fetch(
        new Request('http://localhost/test', {
          headers,
          body: JSON.stringify(requestMessage),
          method: 'POST',
        }),
      )
      await expect(response.json()).resolves.toEqual(
        createUnsignedToken({ typ: 'result', val: 'hello' }),
      )
      expect(response.headers.get('access-control-allow-origin')).toBe('http://example.com')
      expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
      expect(response.headers.get('access-control-allow-headers')).toBe(
        'Content-Type, enkaku-session-id',
      )
      expect(response.headers.get('access-control-expose-headers')).toBe('enkaku-session-id')
      expect(response.headers.get('access-control-max-age')).toBe('86400')

      await server.dispose()
    })
  })
})

describe('POST-based SSE sessions', () => {
  type Protocol = {
    'test/stream': {
      type: 'stream'
      param: { type: 'string' }
      receive: { type: 'number' }
      result: { type: 'string' }
    }
    'test/channel': {
      type: 'channel'
      param: { type: 'string' }
      send: { type: 'string' }
      receive: { type: 'number' }
      result: { type: 'string' }
    }
  }

  function postMessage(
    handleRequest: (request: Request) => Promise<Response>,
    message: unknown,
    sessionID?: string,
  ): Promise<Response> {
    const headers = new Headers()
    headers.set('content-type', 'application/json')
    if (sessionID != null) {
      headers.set('enkaku-session-id', sessionID)
    }
    return handleRequest(
      new Request('http://localhost/test', {
        headers,
        body: JSON.stringify(message),
        method: 'POST',
      }),
    )
  }

  test('first stream POST creates SSE session', async () => {
    const bridge = createServerBridge<Protocol>()
    const message = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r1',
      prm: 'hello',
    })
    const response = await postMessage(bridge.handleRequest, message)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('enkaku-session-id')).toBeTruthy()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  test('first channel POST creates SSE session', async () => {
    const bridge = createServerBridge<Protocol>()
    const message = createUnsignedToken({
      typ: 'channel',
      prc: 'test/channel',
      rid: 'r1',
      prm: 'hello',
    })
    const response = await postMessage(bridge.handleRequest, message)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('enkaku-session-id')).toBeTruthy()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  test('subsequent stream POST with session ID returns 204', async () => {
    const bridge = createServerBridge<Protocol>()
    const message1 = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r1',
      prm: 'hello',
    })
    const response1 = await postMessage(bridge.handleRequest, message1)
    expect(response1.status).toBe(200)
    const sessionID = response1.headers.get('enkaku-session-id') as string

    const message2 = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r2',
      prm: 'world',
    })
    const response2 = await postMessage(bridge.handleRequest, message2, sessionID)
    expect(response2.status).toBe(204)
  })

  test('stream POST with invalid session ID returns 400', async () => {
    const bridge = createServerBridge<Protocol>()
    const message = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r1',
      prm: 'hello',
    })
    const response = await postMessage(bridge.handleRequest, message, 'nonexistent')
    expect(response.status).toBe(400)
  })

  test('routes responses through SSE stream', async () => {
    const bridge = createServerBridge<Protocol>()
    const message = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r1',
      prm: 'hello',
    })
    const response = await postMessage(bridge.handleRequest, message)
    expect(response.status).toBe(200)

    // Read the client message from the bridge's readable stream
    const reader = bridge.stream.readable.getReader()
    const { value: clientMessage } = await reader.read()
    expect(clientMessage).toEqual(message)
    reader.releaseLock()

    // Write a response through the bridge's writable stream
    const writer = bridge.stream.writable.getWriter()
    const serverResponse = createUnsignedToken({ typ: 'receive', rid: 'r1', val: 42 })
    await writer.write(serverResponse as never)
    writer.releaseLock()

    // Read SSE data from the response body
    const body = response.body as ReadableStream<Uint8Array>
    const textReader = body.pipeThrough(new TextDecoderStream()).getReader()

    // First chunk is the SSE comment flush
    const { value: firstChunk } = await textReader.read()
    expect(firstChunk).toBe(':\n\n')

    // Second chunk should be the data event
    const { value: dataChunk } = await textReader.read()
    expect(dataChunk).toBe(`data: ${JSON.stringify(serverResponse)}\n\n`)
    textReader.releaseLock()
  })

  test('rejects session creation when maxSessions reached', async () => {
    const bridge = createServerBridge<Protocol>({ maxSessions: 1 })
    const message1 = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r1',
      prm: 'hello',
    })
    const response1 = await postMessage(bridge.handleRequest, message1)
    expect(response1.status).toBe(200)

    const message2 = createUnsignedToken({
      typ: 'stream',
      prc: 'test/stream',
      rid: 'r2',
      prm: 'world',
    })
    const response2 = await postMessage(bridge.handleRequest, message2)
    expect(response2.status).toBe(503)
  })
})
