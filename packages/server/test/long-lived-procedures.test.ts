import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  hold: {
    type: 'channel',
    param: { type: 'object', properties: {}, additionalProperties: false },
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
  ping: {
    type: 'request',
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

type TestTransports = DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>

function createHoldHandlers(holdSignals: Array<AbortSignal>): ProcedureHandlers<Protocol> {
  return {
    hold: (ctx: { signal: AbortSignal }) =>
      new Promise<string>((resolve) => {
        holdSignals.push(ctx.signal)
        ctx.signal.addEventListener('abort', () => resolve('done'))
      }),
    ping: () => 'pong',
  } as unknown as ProcedureHandlers<Protocol>
}

describe('longLivedProcedures resource limits', () => {
  test('long-lived channels are exempt from controllerTimeoutMs', async () => {
    const holdSignals: Array<AbortSignal> = []
    const transports: TestTransports = new DirectTransports()
    const timeoutHandler = vi.fn()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers: createHoldHandlers(holdSignals),
      transport: transports.server,
      limits: { controllerTimeoutMs: 50, longLivedProcedures: ['hold'] },
    })
    server.events.on('handlerTimeout', timeoutHandler)

    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'hold',
        rid: 'c1',
        prm: {},
      }) as AnyClientMessageOf<Protocol>,
    )
    // Cleanup interval runs every min(controllerTimeoutMs, 10000) = 50ms
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(timeoutHandler).not.toHaveBeenCalled()
    expect(holdSignals).toHaveLength(1)
    expect(holdSignals[0].aborted).toBe(false)

    await server.dispose()
    await transports.dispose()
  })

  test('long-lived channels do not consume maxConcurrentHandlers slots', async () => {
    const holdSignals: Array<AbortSignal> = []
    const transports: TestTransports = new DirectTransports()
    const errorCodes: Array<string> = []
    const server = serve<Protocol>({
      requireAuth: false,
      handlers: createHoldHandlers(holdSignals),
      transport: transports.server,
      limits: { maxConcurrentHandlers: 1, longLivedProcedures: ['hold'] },
    })
    server.events.on('handlerError', (event) => {
      errorCodes.push(event.error.code)
    })

    // Two concurrent long-lived channels with maxConcurrentHandlers: 1
    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'hold',
        rid: 'c1',
        prm: {},
      }) as AnyClientMessageOf<Protocol>,
    )
    await transports.client.write(
      createUnsignedToken({
        typ: 'channel',
        prc: 'hold',
        rid: 'c2',
        prm: {},
      }) as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(holdSignals).toHaveLength(2)

    // A regular request still has its full handler budget available
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'ping',
        rid: 'r1',
      }) as AnyClientMessageOf<Protocol>,
    )
    let result: unknown
    while (true) {
      const next = await transports.client.read()
      if (next.done) break
      const payload = (next.value as { payload: { typ: string; rid?: string; val?: unknown } })
        .payload
      if (payload.typ === 'result' && payload.rid === 'r1') {
        result = payload.val
        break
      }
    }
    expect(result).toBe('pong')
    expect(errorCodes).not.toContain('EK04')

    await server.dispose()
    await transports.dispose()
  })
})
