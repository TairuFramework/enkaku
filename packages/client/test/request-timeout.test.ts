import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Client, RequestError, RequestTimeoutError } from '../src/index.js'

const protocol = {
  ping: { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function setup(requestTimeoutMs?: number) {
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const client = new Client<Protocol>({ transport: transports.client, requestTimeoutMs })
  return { transports, client }
}

describe('request timeout', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('expiry rejects with a RequestTimeoutError naming the procedure', async () => {
    const { transports, client } = setup(1000)
    // Consume the outgoing request so the write settles; never reply.
    const reading = transports.server.read()
    const call = client.request('ping')
    await reading
    const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await rejected
    await call.catch((error) => {
      expect(error).toBeInstanceOf(RequestError)
      expect(error.code).toBe('RequestTimeout')
      expect(error.data).toEqual({ procedure: 'ping', timeoutMs: 1000 })
    })
  })

  test('per-call timeout overrides the construction default', async () => {
    const { transports, client } = setup(10_000)
    const reading = transports.server.read()
    const call = client.request('ping', { timeout: 500 })
    await reading
    const rejected = expect(call).rejects.toBeInstanceOf(RequestTimeoutError)
    await vi.advanceTimersByTimeAsync(500)
    await rejected
  })

  test('timeout: 0 disables even when a default is set', async () => {
    const { transports, client } = setup(1000)
    const reading = transports.server.read()
    const call = client.request('ping', { timeout: 0 })
    await reading
    let settled = false
    void call.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    await vi.advanceTimersByTimeAsync(5000)
    expect(settled).toBe(false)
    call.abort('cleanup')
    await call.catch(() => {})
  })

  test('no default and no per-call timeout arms no timer', async () => {
    const { transports, client } = setup()
    const reading = transports.server.read()
    const call = client.request('ping')
    await reading
    let settled = false
    void call.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(settled).toBe(false)
    call.abort('cleanup')
    await call.catch(() => {})
  })

  test('a request that resolves before expiry does not later time out', async () => {
    const { transports, client } = setup(1000)
    const reading = transports.server.read()
    const call = client.request('ping')
    const read = await reading
    const { createUnsignedToken: unsignedToken } = await import('@kokuin/token')
    const rid = (read.value as { payload: { rid: string } }).payload.rid
    await transports.server.write(unsignedToken({ typ: 'result', rid, val: 'ok' }))
    await expect(call).resolves.toBe('ok')
    // Advancing past the deadline produces no late rejection.
    await vi.advanceTimersByTimeAsync(5000)
  })

  test('NaN / Infinity / negative arm no timer', async () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const { transports, client } = setup()
      const reading = transports.server.read()
      const call = client.request('ping', { timeout: bad })
      await reading
      let settled = false
      void call.then(
        () => {
          settled = true
        },
        () => {
          settled = true
        },
      )
      await vi.advanceTimersByTimeAsync(60_000)
      expect(settled).toBe(false)
      call.abort('cleanup')
      await call.catch(() => {})
    }
  })
})
