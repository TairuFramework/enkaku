import type { ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, serve } from '@enkaku/server'
import { describe, expect, test } from 'vitest'

import { createServerBridge, ServerTransport } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createPost(payload: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ header: {}, payload }),
  })
}

async function readAll(response: Response): Promise<string> {
  return await new Response(response.body).text()
}

describe('bridge dispose', () => {
  test('closing the writable ends open SSE sessions after delivering queued frames', async () => {
    const bridge = createServerBridge()
    const res = await bridge.handleRequest(createPost({ typ: 'stream', rid: 's1', prc: 'p' }))
    expect(res.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    void writer.write({ payload: { typ: 'receive', rid: 's1', val: 'last' } } as never)
    await writer.close()

    const text = await readAll(res)
    expect(text).toContain('"val":"last"')
  })

  test('closing the writable settles a pending unary request with 503', async () => {
    const bridge = createServerBridge({ requestTimeoutMs: 60_000 })
    const pending = bridge.handleRequest(createPost({ typ: 'request', rid: 'r1', prc: 'p' }))
    await new Promise((resolve) => setTimeout(resolve, 10))

    await bridge.stream.writable.close()

    const res = await pending
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Server shutting down' })
  })

  test('aborting the writable settles pending requests and ends sessions', async () => {
    const bridge = createServerBridge({ requestTimeoutMs: 60_000 })
    const sse = await bridge.handleRequest(createPost({ typ: 'stream', rid: 's1', prc: 'p' }))
    const pending = bridge.handleRequest(createPost({ typ: 'request', rid: 'r1', prc: 'p' }))
    await new Promise((resolve) => setTimeout(resolve, 10))

    await bridge.stream.writable.abort(new Error('gone'))

    expect((await pending).status).toBe(503)
    await readAll(sse)
  })

  test('dispose() is explicit, idempotent and closes the readable', async () => {
    const bridge = createServerBridge({ requestTimeoutMs: 60_000 })
    const pending = bridge.handleRequest(createPost({ typ: 'request', rid: 'r1', prc: 'p' }))
    const reader = bridge.stream.readable.getReader()
    const first = await reader.read()
    expect(first.done).toBe(false)

    bridge.dispose()
    bridge.dispose()

    expect((await pending).status).toBe(503)
    expect((await reader.read()).done).toBe(true)
  })

  test('requests after dispose are rejected with 503 and CORS headers', async () => {
    const bridge = createServerBridge({ allowedOrigin: 'http://app.test' })
    bridge.dispose()

    for (const typ of ['request', 'stream', 'event']) {
      const res = await bridge.handleRequest(
        createPost({ typ, rid: `r-${typ}`, prc: 'p' }, { origin: 'http://app.test' }),
      )
      expect(res.status).toBe(503)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://app.test')
      expect(await res.json()).toEqual({ error: 'Server shutting down' })
    }
  })

  test('a request whose body is still being read at dispose is rejected with 503', async () => {
    const bridge = createServerBridge({ requestTimeoutMs: 60_000 })
    const body = JSON.stringify({ header: {}, payload: { typ: 'request', rid: 'r1', prc: 'p' } })
    let push: ReadableStreamDefaultController<Uint8Array> | undefined
    const pending = bridge.handleRequest(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new ReadableStream<Uint8Array>({
          start(ctrl) {
            push = ctrl
          },
        }),
        // @ts-expect-error required by Node for streamed bodies
        duplex: 'half',
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 10))

    bridge.dispose()
    push?.enqueue(new TextEncoder().encode(body))
    push?.close()

    expect((await pending).status).toBe(503)
  })

  test('Server dispose settles an in-flight HTTP request promptly', async () => {
    const handlers = {
      'test/request': (ctx: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve('aborted'), { once: true })
        }),
    } as unknown as ProcedureHandlers<Protocol>

    const transport = new ServerTransport<Protocol>({ requestTimeoutMs: 60_000 })
    const server = serve<Protocol>({ handlers, requireAuth: false, transport })

    const pending = transport.fetch(createPost({ typ: 'request', rid: 'r1', prc: 'test/request' }))
    await new Promise((resolve) => setTimeout(resolve, 20))

    const start = Date.now()
    await server.dispose()
    const res = await pending
    expect(res.status).toBe(503)
    expect(Date.now() - start).toBeLessThan(1000)
  })

  test('Server dispose ends an open SSE session', async () => {
    const transport = new ServerTransport<Protocol>()
    const server = serve<Protocol>({ handlers: {} as never, requireAuth: false, transport })

    const res = await transport.fetch(createPost({ typ: 'stream', rid: 's1', prc: 'unknown' }))
    expect(res.status).toBe(200)

    await server.dispose()
    // Resolves rather than hanging until the client aborts or the session expires.
    await readAll(res)
  })
})
