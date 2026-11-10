import { describe, expect, test, vi } from 'vitest'

import { createServerBridge, type FrameWrittenInfo, ServerTransport } from '../src/index.js'

function post(typ: 'request' | 'stream', rid = 'r1'): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    body: JSON.stringify({ payload: { typ, rid, prc: 'test/procedure' } }),
  })
}

describe('written frame bytes', () => {
  test('reports unary response bytes with rid', async () => {
    const frames: Array<FrameWrittenInfo> = []
    const bridge = createServerBridge({ onFrameWritten: (info) => frames.push(info) })
    const incoming = bridge.stream.readable.getReader()
    const writer = bridge.stream.writable.getWriter()
    const pending = bridge.handleRequest(post('request'))
    try {
      await incoming.read()
      await writer.write({ payload: { typ: 'result', rid: 'r1', val: '雪😀' } } as never)
      const response = await pending
      const body = await response.text()
      expect(body).toBe('{"payload":{"typ":"result","rid":"r1","val":"雪😀"}}')
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(frames).toEqual([
        { kind: 'response', bytes: new TextEncoder().encode(body).byteLength, rid: 'r1' },
      ])
      expect(frames[0]?.bytes).toBeGreaterThan(body.length)
    } finally {
      incoming.releaseLock()
      writer.releaseLock()
      bridge.dispose()
      await pending
    }
  })

  test('reports sse frame bytes with rid and sessionID', async () => {
    const frames: Array<FrameWrittenInfo> = []
    const bridge = createServerBridge({ onFrameWritten: (info) => frames.push(info) })
    try {
      const response = await bridge.handleRequest(post('stream'))
      if (response.body == null) throw new Error('Expected SSE body')
      const reader = response.body.getReader()
      await reader.read()
      const writer = bridge.stream.writable.getWriter()
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: '雪😀' } } as never)
      const chunk = (await reader.read()).value
      expect(new TextDecoder().decode(chunk)).toBe(
        'data: {"payload":{"typ":"receive","rid":"r1","val":"雪😀"}}\n\n',
      )
      expect(frames).toEqual([
        { kind: 'heartbeat', bytes: 3, sessionID: response.headers.get('enkaku-session-id') },
        {
          kind: 'sse',
          bytes: chunk?.byteLength,
          rid: 'r1',
          sessionID: response.headers.get('enkaku-session-id'),
        },
      ])
      reader.releaseLock()
      writer.releaseLock()
    } finally {
      bridge.dispose()
    }
  })

  test('reports heartbeat without rid', async () => {
    vi.useFakeTimers()
    const frames: Array<FrameWrittenInfo> = []
    const transport = new ServerTransport({
      heartbeatIntervalMs: 1000,
      onFrameWritten: (info) => frames.push(info),
    })
    try {
      const response = await transport.fetch(post('stream'))
      if (response.body == null) throw new Error('Expected SSE body')
      const reader = response.body.getReader()
      await reader.read()
      expect(frames).toEqual([
        { kind: 'heartbeat', bytes: 3, sessionID: response.headers.get('enkaku-session-id') },
      ])
      expect(frames[0]?.rid).toBeUndefined()
      vi.advanceTimersByTime(1000)
      const chunk = (await reader.read()).value
      expect(new TextDecoder().decode(chunk)).toBe(':\n\n')
      expect(frames).toEqual([
        { kind: 'heartbeat', bytes: 3, sessionID: response.headers.get('enkaku-session-id') },
        { kind: 'heartbeat', bytes: 3, sessionID: response.headers.get('enkaku-session-id') },
      ])
      reader.releaseLock()
    } finally {
      await transport.dispose()
      vi.useRealTimers()
    }
  })

  test.each(['request', 'stream'] as const)(
    'callback error does not break write: %s',
    async (typ) => {
      const error = new Error('observer failed')
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const bridge = createServerBridge({
        onFrameWritten: () => {
          throw error
        },
      })
      const incoming = bridge.stream.readable.getReader()
      const writer = bridge.stream.writable.getWriter()
      const pending = bridge.handleRequest(post(typ))
      try {
        await incoming.read()
        await writer.write({ payload: { typ: 'result', rid: 'r1', val: 'hello' } } as never)
        const response = await pending
        if (typ === 'request') {
          expect(await response.text()).toContain('hello')
        } else {
          if (response.body == null) throw new Error('Expected SSE body')
          const reader = response.body.getReader()
          await reader.read()
          expect(new TextDecoder().decode((await reader.read()).value)).toContain('hello')
          reader.releaseLock()
        }
        expect(log).toHaveBeenCalledWith(expect.any(String), error)
      } finally {
        incoming.releaseLock()
        writer.releaseLock()
        bridge.dispose()
        log.mockRestore()
        await pending
      }
    },
  )

  test('reports every delivered frame including the frame that triggers buffer overflow', async () => {
    const frames: Array<FrameWrittenInfo> = []
    const onSessionDrop = vi.fn()
    const bridge = createServerBridge({
      maxSessionBufferBytes: 256,
      onSessionDrop,
      onFrameWritten: (info) => frames.push(info),
    })
    try {
      const response = await bridge.handleRequest(post('stream'))
      const writer = bridge.stream.writable.getWriter()
      await writer.write({ payload: { typ: 'receive', rid: 'r1', val: 'x'.repeat(300) } } as never)
      expect(onSessionDrop).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'buffer-overflow' }),
      )
      const body = await response.text()
      const frame = `data: ${JSON.stringify({ payload: { typ: 'receive', rid: 'r1', val: 'x'.repeat(300) } })}\n\n`
      expect(body).toBe(`:\n\n${frame}`)
      const sessionID = response.headers.get('enkaku-session-id')
      expect(frames).toEqual([
        { kind: 'heartbeat', bytes: 3, sessionID },
        { kind: 'sse', bytes: new TextEncoder().encode(frame).byteLength, rid: 'r1', sessionID },
      ])
      expect(frames.reduce((total, info) => total + info.bytes, 0)).toBe(
        new TextEncoder().encode(body).byteLength,
      )
      writer.releaseLock()
    } finally {
      bridge.dispose()
    }
  })
})
