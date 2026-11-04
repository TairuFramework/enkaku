import { describe, expect, test, vi } from 'vitest'

import { createServerBridge, ServerTransport } from '../src/index.js'

function streamPost(rid: string, signal?: AbortSignal): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    signal,
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

describe('session drop diagnostics', () => {
  test.each([false, true])(
    'overflow reports once and isolates throwing callback: %s',
    async (throws) => {
      const onSessionDrop = vi.fn(() => {
        if (throws) throw new Error('observer failed')
      })
      const bridge = createServerBridge({ maxSessionBufferBytes: 256, onSessionDrop })
      try {
        const response = await bridge.handleRequest(streamPost('r1'))
        const writer = bridge.stream.writable.getWriter()
        for (let i = 0; i < 5; i++) {
          await writer.write({
            payload: { typ: 'receive', rid: 'r1', val: 'x'.repeat(300) },
          } as never)
        }
        expect(onSessionDrop).toHaveBeenCalledExactlyOnceWith({
          sessionID: response.headers.get('enkaku-session-id'),
          rid: 'r1',
          reason: 'buffer-overflow',
          error: expect.any(Error),
        })
        const healthy = await bridge.handleRequest(streamPost('r2'))
        if (healthy.body == null) throw new Error('Expected SSE body')
        const reader = healthy.body.getReader()
        await reader.read()
        await writer.write({ payload: { typ: 'receive', rid: 'r2', val: 'hello' } } as never)
        expect(new TextDecoder().decode((await reader.read()).value)).toContain('hello')
        reader.releaseLock()
        writer.releaseLock()
      } finally {
        bridge.dispose()
      }
    },
  )

  test('reports enqueue failure without exposing its cause', async () => {
    const onSessionDrop = vi.fn()
    const bridge = createServerBridge({ onSessionDrop })
    try {
      const response = await bridge.handleRequest(streamPost('r1'))
      const enqueue = vi.spyOn(ReadableStreamDefaultController.prototype, 'enqueue')
      enqueue.mockImplementationOnce(() => {
        throw new Error('private payload')
      })
      const writer = bridge.stream.writable.getWriter()
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: 'secret' } } as never)
      enqueue.mockRestore()
      expect(onSessionDrop).toHaveBeenCalledExactlyOnceWith({
        sessionID: response.headers.get('enkaku-session-id'),
        rid: 'r1',
        reason: 'write-error',
        error: expect.any(Error),
      })
      expect(onSessionDrop.mock.calls[0]?.[0].error.cause).toBeUndefined()
      expect(onSessionDrop.mock.calls[0]?.[0].error.message).not.toContain('private payload')
      writer.releaseLock()
    } finally {
      vi.restoreAllMocks()
      bridge.dispose()
    }
  })

  test('transport forwards idle timeout once despite a throwing callback', async () => {
    vi.useFakeTimers()
    const onSessionDrop = vi.fn(() => {
      throw new Error('observer failed')
    })
    const transport = new ServerTransport({
      sessionTimeoutMs: 1000,
      heartbeatIntervalMs: 0,
      onSessionDrop,
    })
    try {
      const response = await transport.fetch(streamPost('r1'))
      vi.advanceTimersByTime(4000)
      expect(onSessionDrop).toHaveBeenCalledExactlyOnceWith({
        sessionID: response.headers.get('enkaku-session-id'),
        reason: 'idle-timeout',
      })
    } finally {
      await transport.dispose()
      vi.useRealTimers()
    }
  })

  test('dispose and client abort do not report drops', async () => {
    const onSessionDrop = vi.fn()
    const bridge = createServerBridge({ onSessionDrop })
    const abort = new AbortController()
    await bridge.handleRequest(streamPost('r1', abort.signal))
    abort.abort()
    await bridge.handleRequest(streamPost('r2'))
    bridge.dispose()
    expect(onSessionDrop).not.toHaveBeenCalled()
  })
})
