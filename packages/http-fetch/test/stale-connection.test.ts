import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { ClientTransport } from '../src/index.js'

const protocol = {
  'test/event': { type: 'event' },
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol
type ClientMessage = AnyClientMessageOf<Protocol>

const request = {
  payload: { typ: 'request', prc: 'test/request', rid: 'r1', prm: null },
} as unknown as ClientMessage
const event = { payload: { typ: 'event', prc: 'test/event' } } as unknown as ClientMessage

function socketFailure(code: string): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) })
}

function okResponse(): Response {
  return new Response(JSON.stringify({ payload: { typ: 'result', rid: 'r1', val: 'ok' } }), {
    headers: { 'content-type': 'application/json' },
  })
}

function createTransport(fetchFn: (...args: Array<unknown>) => Promise<Response>) {
  return new ClientTransport<Protocol>({
    url: 'http://localhost/',
    fetch: fetchFn as unknown as typeof globalThis.fetch,
  })
}

describe('http-fetch stale pooled connections', () => {
  test.each(['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET'])(
    'retries a request once after a %s failure',
    async (code) => {
      const fetchFn = vi
        .fn()
        .mockRejectedValueOnce(socketFailure(code))
        .mockResolvedValueOnce(okResponse())
      const transport = createTransport(fetchFn)
      try {
        await transport.write(request)
        const result: unknown = await transport.read()
        expect(result).toMatchObject({
          done: false,
          value: { payload: { typ: 'result', rid: 'r1', val: 'ok' } },
        })
        expect(fetchFn).toHaveBeenCalledTimes(2)
      } finally {
        await transport.dispose()
      }
    },
  )

  test('retries a rid-less event once', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(socketFailure('UND_ERR_SOCKET'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const transport = createTransport(fetchFn)
    try {
      await expect(transport.write(event)).resolves.toBeUndefined()
      expect(fetchFn).toHaveBeenCalledTimes(2)
    } finally {
      await transport.dispose()
    }
  })

  test('a second reset errors the readable as before', async () => {
    const fetchFn = vi.fn().mockRejectedValue(socketFailure('ECONNRESET'))
    const transport = createTransport(fetchFn)
    try {
      await expect(transport.write(request)).rejects.toThrow(/Transport write failed/)
      await expect(transport.read()).rejects.toThrow(/Transport write failed/)
      expect(fetchFn).toHaveBeenCalledTimes(2)
    } finally {
      await transport.dispose()
    }
  })

  test('does not retry other network failures', async () => {
    const fetchFn = vi.fn().mockRejectedValue(socketFailure('ECONNREFUSED'))
    const transport = createTransport(fetchFn)
    try {
      await expect(transport.write(request)).rejects.toThrow(/Transport write failed/)
      expect(fetchFn).toHaveBeenCalledTimes(1)
    } finally {
      await transport.dispose()
    }
  })

  test('does not retry after the transport is disposed', async () => {
    let transport: ClientTransport<Protocol> | undefined
    const fetchFn = vi.fn(async () => {
      await transport?.dispose()
      throw socketFailure('ECONNRESET')
    })
    transport = createTransport(fetchFn)
    await expect(transport.write(request)).rejects.toThrow()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('the first request after a same-port server restart succeeds', async () => {
    let handled = 0
    function listen(port = 0): Promise<Server> {
      const server = createServer((req, res) => {
        req.resume()
        req.once('end', () => {
          handled++
          res
            .writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify({ payload: { typ: 'result', rid: 'r1', val: 'ok' } }))
        })
      })
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', () => resolve(server))
      })
    }
    function stop(server: Server): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((error) => (error == null ? resolve() : reject(error)))
        server.closeAllConnections()
      })
    }

    const first = await listen()
    const { port } = first.address() as AddressInfo
    const url = `http://127.0.0.1:${port}`
    const transport = new ClientTransport<Protocol>({ url })
    let second: Server | undefined
    try {
      // Two sequential requests leave a keep-alive socket in the global pool.
      for (let i = 0; i < 2; i++) {
        await transport.write(request)
        await transport.read()
      }
      await stop(first)
      second = await listen(port)

      await transport.write(request)
      const result: unknown = await transport.read()
      expect(result).toMatchObject({
        value: { payload: { typ: 'result', rid: 'r1', val: 'ok' } },
      })
      expect(handled).toBe(3)
    } finally {
      await transport.dispose()
      if (second != null) await stop(second)
    }
  })
})
