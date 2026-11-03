import { describe, expect, test, vi } from 'vitest'

import { createServerBridge } from '../src/index.js'

function createStreamPost(rid: string): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload: { typ: 'stream', rid, prc: 'test/stream' } }),
  })
}

async function readChunks(response: Response, count: number): Promise<Array<string>> {
  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  const chunks: Array<string> = []
  while (chunks.length < count) {
    const { value, done } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value))
  }
  reader.releaseLock()
  return chunks
}

describe('SSE heartbeat', () => {
  test('writes a comment on an idle stream every heartbeatIntervalMs', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({ heartbeatIntervalMs: 1000 })
      const response = await bridge.handleRequest(createStreamPost('r1'))
      expect(response.status).toBe(200)

      vi.advanceTimersByTime(2500)
      const chunks = await readChunks(response, 3)
      // The opening comment, then one per elapsed interval.
      expect(chunks.join('')).toBe(':\n\n:\n\n:\n\n')
      bridge.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  test('heartbeatIntervalMs 0 disables the heartbeat', async () => {
    vi.useFakeTimers()
    try {
      const bridge = createServerBridge({ heartbeatIntervalMs: 0 })
      const response = await bridge.handleRequest(createStreamPost('r1'))
      vi.advanceTimersByTime(60_000)
      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const first = await reader.read()
      expect(new TextDecoder().decode(first.value)).toBe(':\n\n')
      const pending = await Promise.race([
        reader.read().then(() => 'chunk'),
        Promise.resolve('none'),
      ])
      expect(pending).toBe('none')
      reader.releaseLock()
      bridge.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})
