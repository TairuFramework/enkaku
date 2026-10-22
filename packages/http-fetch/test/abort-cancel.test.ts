import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { ClientTransport } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request' },
  'test/stream': { type: 'stream', receive: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function message(payload: Record<string, unknown>): AnyClientMessageOf<Protocol> {
  return { payload } as unknown as AnyClientMessageOf<Protocol>
}

describe('http-fetch abort isolation', () => {
  test('dispose aborts in-flight request POSTs', async () => {
    const signals: Array<AbortSignal | null | undefined> = []
    let releaseRequest: () => void = () => {}
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      signals.push(init?.signal)
      await new Promise<void>((resolve) => {
        releaseRequest = resolve
      })
      return new Response(null, { status: 204 })
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    const write = transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
    try {
      await vi.waitFor(() => expect(signals).toHaveLength(1))
      await transport.dispose()
      expect(signals[0]?.aborted).toBe(true)
    } finally {
      releaseRequest()
      await write
      await transport.dispose()
    }
  })

  test('failed abort POST does not error the transport', async () => {
    const reply = { payload: { typ: 'result', rid: 'r', val: 'ok' } }
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(init?.body as string).payload as { typ: string }
      if (payload.typ === 'abort') {
        throw new TypeError('fetch failed')
      }
      return Response.json(reply)
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    try {
      await expect(transport.write(message({ typ: 'abort', rid: 'aborted' }))).rejects.toThrow()
      await expect(
        transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' })),
      ).resolves.toBeUndefined()
      const result = await transport.read()
      expect(result).toEqual({ done: false, value: reply })
    } finally {
      await transport.dispose()
    }
  })

  test('unparsable abort response does not error the transport', async () => {
    const reply = { payload: { typ: 'result', rid: 'r', val: 'ok' } }
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(init?.body as string).payload as { typ: string }
      if (payload.typ === 'abort') {
        return new Response('not json', { status: 200 })
      }
      return Response.json(reply)
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    try {
      await transport.write(message({ typ: 'abort', rid: 'aborted' }))
      await transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
      const result = await transport.read()
      expect(result).toEqual({ done: false, value: reply })
    } finally {
      await transport.dispose()
    }
  })

  test('failed abort POST keeps an SSE stream alive', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
    })
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(init?.body as string).payload as { typ: string }
      if (payload.typ === 'abort') {
        throw new TypeError('fetch failed')
      }
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'enkaku-session-id': 'session-1' },
      })
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    try {
      await transport.write(message({ typ: 'stream', prc: 'test/stream', rid: 's' }))
      await expect(transport.write(message({ typ: 'abort', rid: 'aborted' }))).rejects.toThrow()

      const event = { payload: { typ: 'receive', rid: 's', val: 'still alive' } }
      streamController.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
      const result = await transport.read()
      expect(result).toEqual({ done: false, value: event })
    } finally {
      await transport.dispose()
      streamController.close()
    }
  })
})
