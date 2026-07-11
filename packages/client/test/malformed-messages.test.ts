import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { Client } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

/** Rejects if the promise has not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out — client read loop is dead')), ms),
    ),
  ])
}

describe('client read loop resilience', () => {
  test('survives a server message with a prototype-polluting rid', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    // Server sends a result for rid "__proto__". Object.prototype is truthy, so a
    // plain-object controller map hands it back and `controller.error` blows up.
    await transports.server.write({
      payload: { typ: 'result', rid: '__proto__', val: 'boom' },
    } as unknown as AnyServerMessageOf<Protocol>)

    // Drive a real request through the same read loop. It must still complete.
    const call = client.request('test/request', { id: 'r1' })
    const received = await transports.server.read()
    expect(received.value?.payload.rid).toBe('r1')
    await transports.server.write({
      payload: { typ: 'result', rid: 'r1', val: 'ok' },
    } as unknown as AnyServerMessageOf<Protocol>)

    await expect(withTimeout(call, 1000)).resolves.toBe('ok')

    await client.dispose()
    await transports.dispose()
  })

  test('survives a throw while dispatching a server message', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const client = new Client<Protocol>({ transport: transports.client })

    const call = client.request('test/request', { id: 'r1' })
    await transports.server.read()

    // `error` payloads run RequestError.fromPayload; a payload shaped to make it
    // throw must not take the read loop down with it.
    await transports.server.write({
      payload: {
        typ: 'error',
        rid: 'r1',
        get code(): string {
          throw new Error('nope')
        },
      },
    } as unknown as AnyServerMessageOf<Protocol>)

    // Loop is alive: a second request still round-trips.
    const call2 = client.request('test/request', { id: 'r2' })
    const received = await transports.server.read()
    expect(received.value?.payload.rid).toBe('r2')
    await transports.server.write({
      payload: { typ: 'result', rid: 'r2', val: 'ok' },
    } as unknown as AnyServerMessageOf<Protocol>)

    await expect(withTimeout(call2, 1000)).resolves.toBe('ok')

    call.abort('cleanup')
    await call.catch(() => {})
    await client.dispose()
    await transports.dispose()
  })
})
