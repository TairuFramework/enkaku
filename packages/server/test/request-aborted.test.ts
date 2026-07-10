import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  'test/request': { type: 'request', result: { type: 'string' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('transport requestAborted', () => {
  test('aborts the running handler for the rid', async () => {
    let handlerSignal: AbortSignal | undefined
    const handler = vi.fn(
      (ctx: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          handlerSignal = ctx.signal
          // Mirrors the well-behaved-handler convention used in
          // lifecycle-events.test.ts: settle when the signal aborts, instead of
          // an unconditional timer that would leave server.dispose() waiting
          // out the full delay regardless of the abort.
          ctx.signal.addEventListener('abort', () => resolve('aborted'), { once: true })
        }),
    )
    const handlers = { 'test/request': handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      transport: transports.server,
    })

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'test/request',
        rid: 'r1',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handlerSignal?.aborted).toBe(false)

    await transports.server.events.emit('requestAborted', {
      rid: 'r1',
      reason: 'ClientDisconnected',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(handlerSignal?.aborted).toBe(true)

    await server.dispose()
    await transports.dispose()
  })

  test('emits handlerAbort with the reason', async () => {
    const handler = vi.fn(
      (ctx: { signal: AbortSignal }) =>
        new Promise((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve('aborted'), { once: true })
        }),
    )
    const handlers = { 'test/request': handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const aborted = vi.fn()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      transport: transports.server,
    })
    server.events.on('handlerAbort', aborted)

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        prc: 'test/request',
        rid: 'r1',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    await transports.server.events.emit('requestAborted', {
      rid: 'r1',
      reason: 'ClientDisconnected',
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(aborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'ClientDisconnected' })

    await server.dispose()
    await transports.dispose()
  })

  test('an unknown rid is ignored', async () => {
    const handlers = {
      'test/request': vi.fn(async () => 'ok'),
    } as unknown as ProcedureHandlers<Protocol>
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers,
      transport: transports.server,
    })

    await expect(
      transports.server.events.emit('requestAborted', { rid: 'nope' }),
    ).resolves.toBeUndefined()

    await server.dispose()
    await transports.dispose()
  })
})
