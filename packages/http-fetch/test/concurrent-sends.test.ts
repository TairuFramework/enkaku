import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { ClientTransport } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request' },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function message(payload: Record<string, unknown>): AnyClientMessageOf<Protocol> {
  return { payload } as unknown as AnyClientMessageOf<Protocol>
}

describe('http-fetch concurrent sends', () => {
  test('requests are dispatched concurrently and an abort bypasses in-flight requests', async () => {
    const started: Array<string> = []
    const pending: Array<() => void> = []
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(init?.body as string).payload as { typ: string; rid: string }
      started.push(`${payload.typ}:${payload.rid}`)
      if (payload.typ === 'abort') {
        return new Response(null, { status: 204 })
      }
      await new Promise<void>((resolve) => pending.push(resolve))
      return new Response(null, { status: 204 })
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    const writes = ['a', 'b', 'c'].map((rid) =>
      transport.write(message({ typ: 'request', prc: 'test/request', rid })),
    )
    await vi.waitFor(() => expect(started).toEqual(['request:a', 'request:b', 'request:c']))

    await transport.write(message({ typ: 'abort', rid: 'a' }))
    expect(started).toContain('abort:a')

    for (const resolve of pending) resolve()
    await Promise.all(writes)
    await transport.dispose()
  })

  test('a channel send waits for its channel open, other messages do not', async () => {
    const started: Array<string> = []
    let releaseOpen: () => void = () => {}
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(init?.body as string).payload as { typ: string; rid?: string }
      started.push(`${payload.typ}:${payload.rid ?? ''}`)
      if (payload.typ === 'channel') {
        await new Promise<void>((resolve) => {
          releaseOpen = resolve
        })
        return new Response(null, {
          status: 200,
          headers: { 'enkaku-session-id': 'session-1' },
        })
      }
      return new Response(null, { status: 204 })
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      fetch: fetchFn as unknown as typeof globalThis.fetch,
    })

    // Null-body SSE response errors the readable, which is irrelevant to ordering.
    transport.write(message({ typ: 'channel', prc: 'test/channel', rid: 'ch' })).catch(() => {})
    const send = transport.write(message({ typ: 'send', rid: 'ch', val: 1 }))
    await transport.write(message({ typ: 'event', prc: 'test/event' }))
    await transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))

    expect(started).toEqual(['channel:ch', 'event:', 'request:r'])

    releaseOpen()
    await send.catch(() => {})
    expect(started.indexOf('channel:ch')).toBeLessThan(started.indexOf('send:ch'))
    await transport.dispose()
  })
})
