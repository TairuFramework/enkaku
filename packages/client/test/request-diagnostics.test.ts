import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports, Transport } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { serve } from '../../server/lib/index.js'
import type { ClientEvents } from '../src/events.js'
import { Client, RequestTimeoutError } from '../src/index.js'

const protocol = {
  ping: { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup(delayMs = 0, abortDelayMs = 0) {
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const client = new Client<Protocol>({ transport: transports.client, requestTimeoutMs: 500 })
  const serverTransport = new Transport<AnyClientMessageOf<Protocol>, AnyServerMessageOf<Protocol>>(
    {
      stream: {
        readable: new ReadableStream({
          async pull(controller) {
            const next = await transports.server.read()
            if (next.done) {
              controller.close()
              return
            }
            // Reproduce a result racing an abort still in transit.
            if (next.value.payload.typ === 'abort' && abortDelayMs > 0) {
              await new Promise<void>((resolve) => setTimeout(resolve, abortDelayMs))
            }
            controller.enqueue(next.value)
          },
        }),
        writable: transports.server.getWritable(),
      },
    },
  )
  const server = serve<Protocol>({
    protocol,
    requireAuth: false,
    transport: serverTransport,
    handlers: {
      ping: async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
        return 'pong'
      },
    },
  })
  const events: Array<{ kind: keyof ClientEvents; data: unknown }> = []
  for (const kind of [
    'requestStart',
    'requestWritten',
    'requestTimeout',
    'requestEnd',
    'lateReply',
  ] as const) {
    client.events.on(kind, (data) => {
      events.push({ kind, data })
    })
  }
  const dispose = async () => {
    await vi.advanceTimersByTimeAsync(1000)
    await client.dispose()
    await server.dispose()
    await transports.dispose()
  }
  return { client, transports, events, dispose }
}

describe('request diagnostics', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('reports a written request timing out before its late server result', async () => {
    const { client, events, dispose } = setup(200, 250)
    try {
      const call = client.request('ping', { timeout: 50 })
      const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
      await vi.advanceTimersByTimeAsync(50)
      await rejected
      expect(events).toEqual([
        { kind: 'requestStart', data: { rid: call.id, procedure: 'ping', type: 'request' } },
        { kind: 'requestWritten', data: { rid: call.id, procedure: 'ping', type: 'request' } },
        {
          kind: 'requestTimeout',
          data: { rid: call.id, procedure: 'ping', budgetMs: 50, elapsedMs: 50, written: true },
        },
        { kind: 'requestEnd', data: { rid: call.id, procedure: 'ping', status: 'error' } },
      ])
      await vi.advanceTimersByTimeAsync(150)
      expect(events.at(-1)).toEqual({
        kind: 'lateReply',
        data: { rid: call.id, procedure: 'ping', terminal: 'timeout', sinceTerminalMs: 150 },
      })
    } finally {
      await dispose()
    }
  })

  test('reports a normal call without a late reply or a later timeout', async () => {
    const { client, events, dispose } = setup()
    try {
      const call = client.request('ping')
      await vi.advanceTimersByTimeAsync(1)
      await expect(call).resolves.toBe('pong')
      await vi.advanceTimersByTimeAsync(1000)
      expect(events).toEqual([
        { kind: 'requestStart', data: { rid: call.id, procedure: 'ping', type: 'request' } },
        { kind: 'requestWritten', data: { rid: call.id, procedure: 'ping', type: 'request' } },
        { kind: 'requestEnd', data: { rid: call.id, procedure: 'ping', status: 'ok' } },
      ])
    } finally {
      await dispose()
    }
  })

  test('reports an unknown rid without copying reply values', async () => {
    const { transports, events, dispose } = setup()
    try {
      const rid = crypto.randomUUID()
      await transports.server.write(
        createUnsignedToken({ payload: { typ: 'result', rid, val: 'private reply' } }),
      )
      await vi.advanceTimersByTimeAsync(0)
      expect(events).toEqual([
        {
          kind: 'lateReply',
          data: { rid, procedure: null, terminal: 'unknown', sinceTerminalMs: null },
        },
      ])
    } finally {
      await dispose()
    }
  })

  test.each(['completed', 'aborted'] as const)(
    'identifies a late reply after %s settlement',
    async (terminal) => {
      const { client, transports, events, dispose } = setup(200, 250)
      try {
        const call = client.request('ping')
        void call.catch(() => {})
        await vi.advanceTimersByTimeAsync(0)
        if (terminal === 'aborted') call.abort('cancelled by caller')
        else await vi.advanceTimersByTimeAsync(200)
        await call.catch(() => {})
        await vi.advanceTimersByTimeAsync(10)
        await transports.server.write(
          createUnsignedToken({ payload: { typ: 'result', rid: call.id, val: 'pong' } }),
        )
        await vi.advanceTimersByTimeAsync(0)
        expect(events.at(-1)).toEqual({
          kind: 'lateReply',
          data: { rid: call.id, procedure: 'ping', terminal, sinceTerminalMs: 10 },
        })
      } finally {
        await dispose()
      }
    },
  )

  test('expires terminal metadata after ten minutes', async () => {
    const { client, transports, events, dispose } = setup()
    try {
      const call = client.request('ping')
      await vi.advanceTimersByTimeAsync(1)
      await call
      await vi.advanceTimersByTimeAsync(600_000)
      await transports.server.write(
        createUnsignedToken({ payload: { typ: 'result', rid: call.id, val: 'pong' } }),
      )
      await vi.advanceTimersByTimeAsync(0)
      expect(events.at(-1)).toEqual({
        kind: 'lateReply',
        data: { rid: call.id, procedure: null, terminal: 'unknown', sinceTerminalMs: null },
      })
    } finally {
      await dispose()
    }
  })

  test('retains only the last thousand terminal requests', async () => {
    const { client, transports, events, dispose } = setup()
    try {
      const calls = []
      for (let offset = 0; offset < 1001; offset += 50) {
        const batch = Array.from({ length: Math.min(50, 1001 - offset) }, () =>
          client.request('ping', { timeout: 0 }),
        )
        await vi.advanceTimersByTimeAsync(1)
        await Promise.all(batch)
        calls.push(...batch)
      }
      const [first, second] = calls
      if (first == null || second == null) throw new Error('Missing completed requests')
      for (const call of [first, second]) {
        await transports.server.write(
          createUnsignedToken({ payload: { typ: 'result', rid: call.id, val: 'pong' } }),
        )
      }
      await vi.advanceTimersByTimeAsync(0)
      expect(events.slice(-2)).toMatchObject([
        { kind: 'lateReply', data: { rid: first.id, terminal: 'unknown', procedure: null } },
        { kind: 'lateReply', data: { rid: second.id, terminal: 'completed', procedure: 'ping' } },
      ])
    } finally {
      await dispose()
    }
  })

  test('times out before a backpressured request frame has been written', async () => {
    const outgoing = new TransformStream<AnyClientMessageOf<Protocol>>()
    const incoming = new TransformStream<AnyServerMessageOf<Protocol>>()
    const transport = new Transport({
      stream: { readable: incoming.readable, writable: outgoing.writable },
    })
    const client = new Client<Protocol>({ transport })
    const events: Array<unknown> = []
    client.events.on('requestWritten', (data) => {
      events.push(data)
    })
    client.events.on('requestTimeout', (data) => {
      events.push(data)
    })
    try {
      const call = client.request('ping', { timeout: 50 })
      const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
      await vi.advanceTimersByTimeAsync(50)
      await rejected
      expect(events).toEqual([
        { rid: call.id, procedure: 'ping', budgetMs: 50, elapsedMs: 50, written: false },
      ])
    } finally {
      const drained = outgoing.readable.pipeTo(new WritableStream())
      await client.dispose()
      await drained
      await incoming.writable.close()
    }
  })

  test('diagnostic observers cannot block calls or surface listener failures', async () => {
    const { client, events, dispose } = setup(200, 250)
    try {
      client.events.on('requestWritten', () => new Promise<void>(() => {}))
      client.events.on('requestTimeout', () => {
        throw new Error('observer failure')
      })
      client.events.on('lateReply', async () => {
        throw new Error('observer failure')
      })
      const call = client.request('ping', { timeout: 50 })
      const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
      await vi.advanceTimersByTimeAsync(50)
      await rejected
      await vi.advanceTimersByTimeAsync(150)
      expect(events.at(-1)).toMatchObject({ kind: 'lateReply', data: { terminal: 'timeout' } })
    } finally {
      await dispose()
    }
  })
})
