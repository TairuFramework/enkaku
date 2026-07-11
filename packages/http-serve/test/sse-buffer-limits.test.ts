import { describe, expect, test, vi } from 'vitest'

import { createServerBridge } from '../src/index.js'

function createStreamPost(rid: string, sessionID?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sessionID != null) {
    headers['enkaku-session-id'] = sessionID
  }
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('SSE buffer limits', () => {
  test('drops a session whose buffer overflows and reports it', async () => {
    const onWriteError = vi.fn()
    const bridge = createServerBridge({ maxSessionBufferBytes: 256, onWriteError })

    const res = await bridge.handleRequest(createStreamPost('r1'))
    expect(res.status).toBe(200)
    // Deliberately never read res.body — the consumer is stalled.

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: big } } as never)
    }
    writer.releaseLock()

    expect(onWriteError).toHaveBeenCalled()
    const { error } = onWriteError.mock.calls[0][0] as { error: Error }
    expect(error.message).toMatch(/overflow/i)
  })

  test('a dropped session frees its slot', async () => {
    const bridge = createServerBridge({ maxSessions: 1, maxSessionBufferBytes: 256 })

    const res1 = await bridge.handleRequest(createStreamPost('r1'))
    expect(res1.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: big } } as never)
    }
    writer.releaseLock()

    // The overflowing session was deleted, so a new one is accepted despite maxSessions: 1.
    const res2 = await bridge.handleRequest(createStreamPost('r2'))
    expect(res2.status).toBe(200)
  })

  test('a healthy session is never dropped', async () => {
    const bridge = createServerBridge({ maxSessions: 1, maxSessionBufferBytes: 1024 })

    const res = await bridge.handleRequest(createStreamPost('r1'))
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    await reader.read() // consume the priming ':\n\n' comment

    const writer = bridge.stream.writable.getWriter()
    for (let i = 0; i < 20; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: 'tick' } } as never)
      await reader.read()
    }
    writer.releaseLock()

    // Still occupied: a second session is refused.
    const res2 = await bridge.handleRequest(createStreamPost('r2'))
    expect(res2.status).toBe(503)

    reader.releaseLock()
  })

  test('a throwing onWriteError does not break isolation for other sessions', async () => {
    const onWriteError = vi.fn(() => {
      throw new Error('onWriteError consumer callback blew up')
    })
    const bridge = createServerBridge({
      maxSessions: 2,
      maxSessionBufferBytes: 256,
      onWriteError,
    })

    // Session A: open it but never read its body, then overflow its buffer so
    // dropSession fires and invokes the throwing onWriteError.
    const resA = await bridge.handleRequest(createStreamPost('a1'))
    expect(resA.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'a1', val: big } } as never)
    }
    writer.releaseLock()

    expect(onWriteError).toHaveBeenCalled()

    // Session B: a fresh, healthy session. If session A's throwing callback
    // errored the shared writable, this write would reject instead of resolving.
    const resB = await bridge.handleRequest(createStreamPost('b1'))
    expect(resB.status).toBe(200)

    const writerB = bridge.stream.writable.getWriter()
    await expect(
      writerB.write({ payload: { typ: 'receive', rid: 'b1', val: 'hello' } } as never),
    ).resolves.toBeUndefined()
    writerB.releaseLock()
  })

  test('a throwing onRequestAborted does not break isolation for other sessions', async () => {
    const onRequestAborted = vi.fn(() => {
      throw new Error('onRequestAborted consumer callback blew up')
    })
    const bridge = createServerBridge({
      maxSessions: 2,
      maxSessionBufferBytes: 256,
      onRequestAborted,
    })

    // Session A: open it but never read its body, then overflow its buffer so
    // dropSession fires and invokes the throwing onRequestAborted (via
    // clearSessionInflight, which runs before reportWriteError).
    const resA = await bridge.handleRequest(createStreamPost('a1'))
    expect(resA.status).toBe(200)

    const writer = bridge.stream.writable.getWriter()
    const big = 'x'.repeat(200)
    for (let i = 0; i < 5; i++) {
      await writer.write({ payload: { typ: 'receive', rid: 'a1', val: big } } as never)
    }
    writer.releaseLock()

    expect(onRequestAborted).toHaveBeenCalledWith({ rid: 'a1', reason: 'SessionClosed' })

    // Session B: a fresh, healthy session. If session A's throwing callback
    // errored the shared writable, this write would reject instead of resolving.
    const resB = await bridge.handleRequest(createStreamPost('b1'))
    expect(resB.status).toBe(200)

    const writerB = bridge.stream.writable.getWriter()
    await expect(
      writerB.write({ payload: { typ: 'receive', rid: 'b1', val: 'hello' } } as never),
    ).resolves.toBeUndefined()
    writerB.releaseLock()
  })
})
