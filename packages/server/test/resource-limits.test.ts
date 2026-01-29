import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Server resource limits', () => {
  test('rejects requests when controller limit reached', async () => {
    const protocol = {
      slow: {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handlerCalls: Array<string> = []
    const resolvers = new Map<string, () => void>()

    const handler = vi.fn((ctx) => {
      const rid = ctx.message.payload.rid
      handlerCalls.push(rid)
      return new Promise<string>((resolve) => {
        resolvers.set(rid, () => resolve('done'))
        ctx.signal.addEventListener('abort', () => resolve('aborted'))
      })
    })
    const handlers = { slow: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxControllers: 2 },
    })

    // Send 3 requests - only 2 should be accepted
    await transports.client.write(createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'r1' }))
    await transports.client.write(createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'r2' }))
    await transports.client.write(createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'r3' }))

    // Wait for r3 rejection
    const r3Error = await transports.client.read()
    expect(r3Error.value?.payload.typ).toBe('error')
    expect(r3Error.value?.payload.rid).toBe('r3')
    expect(r3Error.value?.payload.msg).toContain('limit')

    // Only 2 handlers should have been called
    expect(handlerCalls).toEqual(['r1', 'r2'])

    // Complete handlers
    resolvers.get('r1')?.()
    resolvers.get('r2')?.()

    await server.dispose()
    await transports.dispose()
  })

  test('enforces concurrent handler limit', async () => {
    const protocol = {
      tracked: {
        type: 'request',
        param: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handlerStarts: Array<string> = []
    const resolvers = new Map<string, () => void>()

    const handler = vi.fn((ctx) => {
      handlerStarts.push(ctx.param)
      return new Promise<string>((resolve) => {
        resolvers.set(ctx.param, () => resolve(ctx.param))
        ctx.signal.addEventListener('abort', () => resolve('aborted'))
      })
    })
    const handlers = { tracked: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { maxConcurrentHandlers: 2, maxControllers: 10 },
    })

    // Send 3 requests
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'tracked', rid: 'r1', prm: 'first' }),
    )
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'tracked', rid: 'r2', prm: 'second' }),
    )
    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'tracked', rid: 'r3', prm: 'third' }),
    )

    // r3 should be rejected because handler limit is 2
    const r3Error = await transports.client.read()
    expect(r3Error.value?.payload.typ).toBe('error')
    expect(r3Error.value?.payload.rid).toBe('r3')
    expect(r3Error.value?.payload.msg).toContain('handler limit')

    // Only first two handlers should have started
    expect(handlerStarts).toEqual(['first', 'second'])

    // Complete handlers
    resolvers.get('first')?.()
    resolvers.get('second')?.()

    await server.dispose()
    await transports.dispose()
  })
})
