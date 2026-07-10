import type { ProtocolDefinition } from '@enkaku/protocol'
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
    body: JSON.stringify({ payload: { typ: 'request', rid, prc: 'test/request' } }),
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

    expect(onRequestAborted).toHaveBeenCalledWith(expect.objectContaining({ rid: 'r1' }))
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
})
