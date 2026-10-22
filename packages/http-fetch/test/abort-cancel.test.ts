import type { AnyClientMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { ClientTransport, createTransportStream } from '../src/index.js'

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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

function mockFetch(
  handler: (
    payload: { typ: string; rid?: string },
    signal?: AbortSignal | null,
  ) => Promise<Response>,
) {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    return await handler(JSON.parse(init?.body as string).payload, init?.signal)
  }) as unknown as typeof globalThis.fetch
}

function sseResponse(body: ReadableStream<Uint8Array>) {
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'enkaku-session-id': 'session-1' },
  })
}

describe('http-fetch cancelOnAbort', () => {
  test('signal combination failure is caught and a reused rid can be cancelled', async () => {
    const failure = new Error('Signal combination failed')
    const combine = vi.spyOn(AbortSignal, 'any').mockImplementationOnce(() => {
      throw failure
    })
    const pending = deferred<Response>()
    let requestSignal: AbortSignal | null | undefined
    const stream = createTransportStream<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (payload, signal) => {
        if (payload.typ === 'abort') return new Response(null, { status: 204 })
        requestSignal = signal
        return await pending.promise
      }),
    })
    const reader = stream.readable.getReader()
    const readableError = reader.closed.catch((error: unknown) => error)
    let next: Promise<void> | undefined
    try {
      await expect(
        stream.send(message({ typ: 'request', prc: 'test/request', rid: 'r' })),
      ).rejects.toMatchObject({ message: 'Transport write failed', cause: failure })
      await expect(readableError).resolves.toMatchObject({ cause: failure })
      next = stream.send(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
      await stream.send(message({ typ: 'abort', rid: 'r' }))
      expect(requestSignal?.aborted).toBe(true)
    } finally {
      combine.mockRestore()
      pending.resolve(new Response(null, { status: 204 }))
      await next
      await stream.writable.close()
      reader.releaseLock()
    }
  })

  test('first SSE open does not combine per-request signals', async () => {
    const combine = vi.spyOn(AbortSignal, 'any').mockImplementation(() => {
      throw new Error('Must not combine SSE signals')
    })
    let bodyController!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyController = controller
      },
    })
    const stream = createTransportStream<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async () => sseResponse(body)),
    })
    try {
      await expect(
        stream.send(message({ typ: 'stream', prc: 'test/stream', rid: 's' })),
      ).resolves.toBeUndefined()
      expect(combine).not.toHaveBeenCalled()
    } finally {
      combine.mockRestore()
      await stream.writable.close()
      bodyController.close()
    }
  })

  test.each([true, false])(
    'dispose during body read leaves readable unerrored with cancelOnAbort=%s',
    async (cancelOnAbort) => {
      const stream = createTransportStream<Protocol>({
        url: 'http://localhost/',
        cancelOnAbort,
        fetch: mockFetch(
          async (_payload, signal) =>
            new Response(
              new ReadableStream({
                start(controller) {
                  signal?.addEventListener('abort', () => controller.error(signal.reason), {
                    once: true,
                  })
                },
              }),
            ),
        ),
      })
      const reader = stream.readable.getReader()
      const errors: Array<unknown> = []
      void reader.closed.catch((error: unknown) => errors.push(error))
      try {
        await stream.send(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
        await stream.writable.close()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(errors).toEqual([])
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
    },
  )

  test.each([true, undefined])(
    'in-flight request cancellation with cancelOnAbort=%s',
    async (cancelOnAbort) => {
      let requestSignal: AbortSignal | null | undefined
      const pending = deferred<Response>()
      const aborts: Array<string | undefined> = []
      const transport = new ClientTransport<Protocol>({
        url: 'http://localhost/',
        cancelOnAbort,
        fetch: mockFetch(async (payload, signal) => {
          if (payload.typ === 'abort') {
            aborts.push(payload.rid)
            return new Response(null, { status: 204 })
          }
          requestSignal = signal
          signal?.addEventListener('abort', () => pending.reject(signal.reason), { once: true })
          return await pending.promise
        }),
      })
      const write = transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
      try {
        await vi.waitFor(() => expect(requestSignal).toBeDefined())
        await transport.write(message({ typ: 'abort', rid: 'r' }))
        expect(requestSignal?.aborted).toBe(cancelOnAbort === true)
        expect(aborts).toEqual(['r'])
        if (cancelOnAbort) await expect(write).resolves.toBeUndefined()
      } finally {
        pending.resolve(new Response(null, { status: 204 }))
        await write.catch(() => {})
        await transport.dispose()
      }
    },
  )

  test('dispose aborts in-flight request POSTs with cancelOnAbort enabled', async () => {
    let requestSignal: AbortSignal | null | undefined
    const pending = deferred<Response>()
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (_payload, signal) => {
        requestSignal = signal
        return await pending.promise
      }),
    })
    const write = transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
    try {
      await vi.waitFor(() => expect(requestSignal).toBeDefined())
      await transport.dispose()
      expect(requestSignal?.aborted).toBe(true)
    } finally {
      pending.resolve(new Response(null, { status: 204 }))
      await write
      await transport.dispose()
    }
  })

  test.each([true, false])(
    'non-OK abort response enqueues nothing with cancelOnAbort=%s',
    async (cancelOnAbort) => {
      const reply = { payload: { typ: 'result', rid: 'r', val: 'ok' } }
      const transport = new ClientTransport<Protocol>({
        url: 'http://localhost/',
        cancelOnAbort,
        fetch: mockFetch(async (payload) =>
          payload.typ === 'abort' ? new Response(null, { status: 500 }) : Response.json(reply),
        ),
      })
      try {
        await transport.write(message({ typ: 'abort', rid: 'r' }))
        await transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
        expect(await transport.read()).toEqual({ done: false, value: reply })
      } finally {
        await transport.dispose()
      }
    },
  )

  test('cancel during body read does not error the transport', async () => {
    const reply = { payload: { typ: 'result', rid: 'next', val: 'ok' } }
    let requestSignal: AbortSignal | null | undefined
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (payload, signal) => {
        if (payload.rid === 'next') return Response.json(reply)
        if (payload.typ === 'abort') return new Response(null, { status: 204 })
        requestSignal = signal
        return new Response(
          new ReadableStream({
            start(controller) {
              signal?.addEventListener('abort', () => controller.error(signal.reason), {
                once: true,
              })
            },
          }),
        )
      }),
    })
    try {
      await transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
      await transport.write(message({ typ: 'abort', rid: 'r' }))
      expect(requestSignal?.aborted).toBe(true)
      await transport.write(message({ typ: 'request', prc: 'test/request', rid: 'next' }))
      expect(await transport.read()).toEqual({ done: false, value: reply })
    } finally {
      await transport.dispose()
    }
  })

  test('abort of a queued stream open is not delayed behind it', async () => {
    const connect = deferred<Response>()
    const started: Array<string> = []
    let sessionSignal: AbortSignal | null | undefined
    const body = new ReadableStream<Uint8Array>()
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (payload, signal) => {
        started.push(`${payload.typ}:${payload.rid}`)
        if (payload.rid === 's1') {
          sessionSignal = signal
          return await connect.promise
        }
        return new Response(null, { status: 204 })
      }),
    })
    const first = transport.write(message({ typ: 'stream', prc: 'test/stream', rid: 's1' }))
    const second = transport.write(message({ typ: 'stream', prc: 'test/stream', rid: 's2' }))
    const abort = transport.write(message({ typ: 'abort', rid: 's2' }))
    try {
      connect.resolve(sseResponse(body))
      await Promise.all([first, second, abort])
      expect(started).toEqual(['stream:s1', 'abort:s2'])
      expect(sessionSignal?.aborted).toBe(false)
    } finally {
      await transport.dispose()
    }
  })

  test('stream abort leaves the SSE session alive', async () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>
    let sessionSignal: AbortSignal | null | undefined
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
    })
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (payload, signal) => {
        if (payload.rid === 's1' && payload.typ === 'stream') {
          sessionSignal = signal
          return sseResponse(body)
        }
        return new Response(null, { status: 204 })
      }),
    })
    try {
      await transport.write(message({ typ: 'stream', prc: 'test/stream', rid: 's1' }))
      await transport.write(message({ typ: 'stream', prc: 'test/stream', rid: 's2' }))
      await transport.write(message({ typ: 'abort', rid: 's1' }))
      expect(sessionSignal?.aborted).toBe(false)
      const event = { payload: { typ: 'receive', rid: 's2', val: 'still alive' } }
      streamController.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
      expect(await transport.read()).toEqual({ done: false, value: event })
    } finally {
      await transport.dispose()
      streamController.close()
    }
  })

  test('reused rid: old POST settling keeps the new entry', async () => {
    const pending = [deferred<Response>(), deferred<Response>()] as const
    const signals: Array<AbortSignal | null | undefined> = []
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (payload, signal) => {
        if (payload.typ === 'abort') return new Response(null, { status: 204 })
        const index = signals.length
        signals.push(signal)
        const request = pending[index]
        if (request == null) throw new Error('Unexpected request POST')
        return await request.promise
      }),
    })
    const first = transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
    let second: Promise<void> | undefined
    try {
      await transport.write(message({ typ: 'abort', rid: 'r' }))
      second = transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
      pending[0].resolve(new Response(null, { status: 204 }))
      await first
      await transport.write(message({ typ: 'abort', rid: 'r' }))
      expect(signals.map((signal) => signal?.aborted)).toEqual([true, true])
    } finally {
      for (const request of pending) request.resolve(new Response(null, { status: 204 }))
      await Promise.all([first, second])
      await transport.dispose()
    }
  })

  test('ordering unchanged', async () => {
    const open = deferred<Response>()
    const started: Array<string> = []
    const body = new ReadableStream<Uint8Array>()
    const transport = new ClientTransport<Protocol>({
      url: 'http://localhost/',
      cancelOnAbort: true,
      fetch: mockFetch(async (payload) => {
        started.push(`${payload.typ}:${payload.rid ?? ''}`)
        return payload.typ === 'channel' ? await open.promise : new Response(null, { status: 204 })
      }),
    })
    const channel = transport.write(message({ typ: 'channel', prc: 'test/channel', rid: 'ch' }))
    const send = transport.write(message({ typ: 'send', rid: 'ch', val: 1 }))
    try {
      await transport.write(message({ typ: 'event', prc: 'test/event' }))
      await transport.write(message({ typ: 'request', prc: 'test/request', rid: 'r' }))
      expect(started).toEqual(['channel:ch', 'event:', 'request:r'])
      open.resolve(sseResponse(body))
      await Promise.all([channel, send])
      expect(started).toEqual(['channel:ch', 'event:', 'request:r', 'send:ch'])
    } finally {
      await transport.dispose()
    }
  })
})
