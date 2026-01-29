import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Server dispose timeout', () => {
  test('dispose completes within cleanup timeout even with stuck handlers', async () => {
    const protocol = {
      stuck: {
        type: 'request',
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn(
      () =>
        new Promise<string>(() => {
          // Handler ignores abort signal and never returns
        }),
    )
    const handlers = { stuck: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
      limits: { cleanupTimeoutMs: 100 },
    })

    await transports.client.write(
      createUnsignedToken({ typ: 'request', prc: 'stuck', rid: 'r1' }),
    )

    // Wait for handler to start
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(handler).toHaveBeenCalled()

    // Start dispose - should complete within cleanup timeout
    const start = Date.now()
    await server.dispose()
    const elapsed = Date.now() - start

    // Should complete within ~100ms (cleanup timeout) plus some margin
    expect(elapsed).toBeLessThan(500)

    await transports.dispose()
  })
})
