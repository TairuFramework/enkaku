import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, type RequestHandler, serve } from '../src/index.js'

const protocol = {
  ping: {
    type: 'request',
    result: { type: 'object', properties: { ok: { type: 'boolean' } } },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Server lifecycle events', () => {
  test('emits handlerStart and handlerEnd around a successful request', async () => {
    const handlers = {
      ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
    } as ProcedureHandlers<Protocol>
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      protocol,
      accessControl: false,
      transport: transports.server,
    })

    const start = vi.fn()
    const end = vi.fn()
    server.events.on('handlerStart', start)
    server.events.on('handlerEnd', end)

    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r1',
        prc: 'ping',
      }) as AnyClientMessageOf<Protocol>,
    )

    // Drain the result
    await transports.client.read()
    // Allow the server's .then() continuations (handlerEnd) to flush
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ rid: 'r1', procedure: 'ping', type: 'request' }),
    )
    expect(end).toHaveBeenCalledWith(expect.objectContaining({ rid: 'r1', procedure: 'ping' }))

    await server.dispose()
  })

  test('emits disposing and disposed around server.dispose()', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers: {
        ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
      } as ProcedureHandlers<Protocol>,
      protocol,
      accessControl: false,
      transport: transports.server,
    })

    const disposing = vi.fn()
    const disposed = vi.fn()
    server.events.on('disposing', disposing)
    server.events.on('disposed', disposed)

    await server.dispose('test-reason')

    expect(disposing).toHaveBeenCalledWith({ reason: 'test-reason' })
    expect(disposed).toHaveBeenCalledWith({ reason: 'test-reason' })
  })

  test('emits handlerAbort with reason Close when client aborts a running request', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handler = vi.fn(
      (ctx) =>
        new Promise((resolve) => {
          ctx.signal.addEventListener('abort', () => resolve({ ok: true }), { once: true })
        }),
    )
    const server = serve<Protocol>({
      handlers: { ping: handler } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      accessControl: false,
      transport: transports.server,
    })

    const aborted = vi.fn()
    server.events.on('handlerAbort', aborted)

    // Send a real request so server creates a controller for rid 'r1'
    await transports.client.write(
      createUnsignedToken({
        typ: 'request',
        rid: 'r1',
        prc: 'ping',
      }) as AnyClientMessageOf<Protocol>,
    )
    // Wait for the handler to start
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handler).toHaveBeenCalled()

    // Now send the abort for the real rid
    await transports.client.write(
      createUnsignedToken({
        typ: 'abort',
        rid: 'r1',
        rsn: 'Close',
      }) as AnyClientMessageOf<Protocol>,
    )
    // Allow abort handling to propagate
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(aborted).toHaveBeenCalledWith({ rid: 'r1', reason: 'Close' })

    await server.dispose()
  })
})
