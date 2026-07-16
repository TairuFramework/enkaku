import type { ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, serve } from '@enkaku/server'
import { describe, expect, test, vi } from 'vitest'

import { createServerBridge, ServerTransport } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createRequestPost(rid: string, signal: AbortSignal): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // `header` is part of the token shape a real client sends, and the server
    // reads it to extract the trace context.
    body: JSON.stringify({ header: {}, payload: { typ: 'request', rid, prc: 'test/request' } }),
    signal,
  })
}

function createStreamPost(rid: string): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('client disconnect', () => {
  test('emits requestAborted when a request client disconnects', async () => {
    const onRequestAborted = vi.fn()
    const bridge = createServerBridge({ onRequestAborted })
    const abort = new AbortController()

    const pending = bridge.handleRequest(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    abort.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(onRequestAborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    // The deferred Response must settle rather than leak.
    const res = await pending
    expect(res.status).toBe(499)
  })

  test('emits requestAborted for every rid in a dropped session', async () => {
    const onRequestAborted = vi.fn()
    const bridge = createServerBridge({ maxSessionBufferBytes: 256, onRequestAborted })

    const res = await bridge.handleRequest(createStreamPost('r1'))
    expect(res.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: big } } as never)
    }
    writer.releaseLock()

    // Exactly `dropSession`'s reason — not the SSE listener's 'ClientDisconnected'.
    expect(onRequestAborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'SessionClosed' })
  })

  test('ServerTransport re-emits requestAborted on its events emitter', async () => {
    const transport = new ServerTransport<Protocol>()
    const listener = vi.fn()
    transport.events.on('requestAborted', listener)

    const abort = new AbortController()
    void transport.fetch(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    abort.abort()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(listener).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    await transport.dispose()
  })

  test('a disconnecting HTTP client aborts the handler of a Server on a ServerTransport', async () => {
    // The whole seam, end to end: the bridge emits requestAborted, ServerTransport
    // re-emits it on its events emitter, and the Server aborts the handler for the
    // rid — none of which was covered jointly.
    let handlerSignal: AbortSignal | undefined
    const handlers = {
      'test/request': (ctx: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          handlerSignal = ctx.signal
          ctx.signal.addEventListener('abort', () => resolve('aborted'), { once: true })
        }),
    } as unknown as ProcedureHandlers<Protocol>

    const transport = new ServerTransport<Protocol>()
    const server = serve<Protocol>({ handlers, requireAuth: false, transport })

    const abort = new AbortController()
    const pending = transport.fetch(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handlerSignal?.aborted).toBe(false)

    // The HTTP client goes away before the handler replies.
    abort.abort()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handlerSignal?.aborted).toBe(true)
    expect(handlerSignal?.reason).toBe('ClientDisconnected')
    expect((await pending).status).toBe(499)

    await server.dispose()
  })

  test('a throwing onRequestAborted does not break the disconnect path', async () => {
    // The request-signal listener calls reportRequestAborted *directly*, unlike
    // the sweep and the SSE listener which route through clearSessionInflight.
    // So its guard is the one with no test of its own: a future edit that dropped
    // the try/catch would go unnoticed. Mirrors the onWriteError isolation test
    // in sse-buffer-limits.test.ts.
    //
    // WHATWG event dispatch reports listener exceptions through the global error
    // mechanism, so `abort.abort()` itself cannot throw synchronously to the
    // caller -- a dropped try/catch in `reportRequestAborted` does not surface as
    // a thrown error here, it surfaces as a process-level `uncaughtException`.
    // Capture that with a scoped listener so the red (if the guard regresses) is
    // a concrete `expect` failure rather than the whole test process going down.
    const onRequestAborted = vi.fn(() => {
      throw new Error('onRequestAborted consumer callback blew up')
    })
    const bridge = createServerBridge({ onRequestAborted })

    const abort = new AbortController()
    const pending = bridge.handleRequest(createRequestPost('r1', abort.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    // r2 is kept PENDING through r1's throwing abort below: a corrupted shared
    // sink (rather than just a swallowed exception) would surface on IT, not on
    // a later, unrelated request the way a sequential-only proxy could not
    // distinguish -- mirrors the cross-session isolation proof in
    // sse-buffer-limits.test.ts:113, but for a request rather than a session.
    const abort2 = new AbortController()
    const pending2 = bridge.handleRequest(createRequestPost('r2', abort2.signal))
    await new Promise((resolve) => setTimeout(resolve, 10))

    const uncaught: Array<Error> = []
    const onUncaughtException = (error: Error) => uncaught.push(error)
    process.once('uncaughtException', onUncaughtException)
    try {
      abort.abort()
      await new Promise((resolve) => setTimeout(resolve, 10))
    } finally {
      process.removeListener('uncaughtException', onUncaughtException)
    }

    expect(onRequestAborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })
    // The throw must not have escaped past reportRequestAborted's try/catch: if
    // the guard were removed, `uncaught` would carry the listener's exception.
    expect(uncaught).toHaveLength(0)

    // The throw must not have escaped: the deferred Response still settles rather
    // than leaking, and the bridge is still usable for a fresh request.
    expect((await pending).status).toBe(499)

    // r2 was still in flight -- concurrently, not merely afterwards -- when r1's
    // callback threw. Confirm it settles correctly rather than having been
    // corrupted by the throw.
    abort2.abort()
    expect((await pending2).status).toBe(499)
  })
})
