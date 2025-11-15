import { setTimeout } from 'node:timers/promises'
import type { ProtocolDefinition } from '@enkaku/protocol'
import { type EventHandler, type RequestHandler, serve } from '@enkaku/server'
import { createUnsignedToken } from '@enkaku/token'
import { jest } from '@jest/globals'

import { ServerTransport } from '../src/index.js'

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

    const testEventHandler = jest.fn() as jest.Mock<EventHandler<Protocol, 'test/event'>>
    const testRequestHandler = jest.fn(() => {
      return setTimeout(100, 'hello')
    }) as jest.Mock<RequestHandler<Protocol, 'test/request'>>

    const handlers = {
      'test/event': testEventHandler,
      'test/request': testRequestHandler,
    }
    const transport = new ServerTransport<Protocol>()
    const server = serve<Protocol>({ handlers, public: true, transport })

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
    expect(res.headers.get('allow')).toBe('GET, POST, OPTIONS')
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
      test('from any origin (implicit "*")', async () => {
        const transport = new ServerTransport<Protocol>()
        const headers = new Headers()
        headers.set('origin', 'http://example.com')
        const res = await transport.fetch(
          new Request('http://localhost/test', { headers, method: 'OPTIONS' }),
        )
        expect(res.status).toBe(204)
        expect(res.headers.get('access-control-allow-origin')).toBe('http://example.com')
        expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
        expect(res.headers.get('access-control-allow-headers')).toBe(
          'Content-Type, enkaku-session-id',
        )
        expect(res.headers.get('access-control-max-age')).toBe('86400')
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
        expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
        expect(res.headers.get('access-control-allow-headers')).toBe(
          'Content-Type, enkaku-session-id',
        )
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
        expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
        expect(res.headers.get('access-control-allow-headers')).toBe(
          'Content-Type, enkaku-session-id',
        )
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
      const testRequestHandler = jest.fn(() => {
        return setTimeout(100, 'hello')
      }) as jest.Mock<RequestHandler<Protocol, 'test/request'>>

      const handlers = {
        'test/request': testRequestHandler,
      }
      const transport = new ServerTransport<Protocol>({ allowedOrigin: 'http://example.com' })
      const server = serve<Protocol>({ handlers, public: true, transport })

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
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
      expect(response.headers.get('access-control-allow-headers')).toBe(
        'Content-Type, enkaku-session-id',
      )
      expect(response.headers.get('access-control-max-age')).toBe('86400')

      await server.dispose()
    })

    // test('handles POST requests', async () => {
    //   const testRequestHandler = jest.fn(() => {
    //     return setTimeout(100, 'hello')
    //   }) as jest.Mock<RequestHandler<Protocol, 'test/request'>>

    //   const handlers = {
    //     'test/request': testRequestHandler,
    //   }
    //   const transport = new ServerTransport<Protocol>({ allowedOrigin: 'http://example.com' })
    //   const server = serve<Protocol>({ handlers, public: true, transport })

    //   const headers = new Headers()
    //   headers.set('content-type', 'application/json')
    //   headers.set('origin', 'http://example.com')

    //   const optionsResponse = await transport.fetch(
    //     new Request('http://localhost/test', {
    //       headers,
    //       method: 'OPTIONS',
    //     }),
    //   )
    //   expect(optionsResponse.headers.get('access-control-allow-origin')).toBe('http://example.com')
    //   expect(optionsResponse.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
    //   expect(optionsResponse.headers.get('access-control-allow-headers')).toBe(
    //     'Content-Type, enkaku-session-id',
    //   )

    //   const requestMessage = createUnsignedToken({ typ: 'request', prc: 'test/request' })
    //   const response = await transport.fetch(
    //     new Request('http://localhost/test', {
    //       headers,
    //       body: JSON.stringify(requestMessage),
    //       method: 'POST',
    //     }),
    //   )
    //   await expect(response.json()).resolves.toEqual(
    //     createUnsignedToken({ typ: 'result', val: 'hello' }),
    //   )

    //   await server.dispose()
    // })
  })
})
