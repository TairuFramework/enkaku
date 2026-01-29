import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'
import { createResourceLimiter } from '../src/limits.js'

describe('Controller timeout cleanup', () => {
  test('ResourceLimiter detects expired controllers after real delay', async () => {
    const limiter = createResourceLimiter({ controllerTimeoutMs: 50 })
    limiter.addController('r1')

    // Wait for the timeout to expire
    await new Promise((resolve) => setTimeout(resolve, 100))

    const expired = limiter.getExpiredControllers()
    expect(expired).toEqual(['r1'])
  })

  test('Server cleanup interval removes expired controllers', async () => {
    const protocol = {
      slow: {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    let handlerAbortSignal: AbortSignal | null = null
    const handlerResolve: Array<(value: string) => void> = []
    const handler = vi.fn((ctx) => {
      handlerAbortSignal = ctx.signal
      return new Promise<string>((resolve) => {
        handlerResolve.push(resolve)
        // Listen for abort so the promise can settle
        ctx.signal.addEventListener('abort', () => resolve('aborted'))
      })
    })
    const handlers = { slow: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const timeoutHandler = vi.fn()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { controllerTimeoutMs: 50 },
    })
    server.events.on('handlerTimeout', timeoutHandler)

    await transports.client.write(createUnsignedToken({ typ: 'request', prc: 'slow', rid: 'r1' }))

    // Wait for handler to start
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handler).toHaveBeenCalled()

    // Wait for timeout and cleanup interval to fire
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(timeoutHandler).toHaveBeenCalledWith({ rid: 'r1' })
    expect(handlerAbortSignal?.aborted).toBe(true)

    await server.dispose()
    await transports.dispose()
  })
})
