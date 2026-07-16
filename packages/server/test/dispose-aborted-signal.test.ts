import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Server external signal', () => {
  test('a signal already aborted before construction still disposes the server', async () => {
    const controller = new AbortController()
    controller.abort()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
      signal: controller.signal,
    })

    const disposing = vi.fn()
    const disposed = vi.fn()
    server.events.on('disposing', disposing)
    server.events.on('disposed', disposed)

    // The dispose callback runs synchronously inside the Disposer base
    // constructor when the signal is already aborted -- before Server's own
    // constructor body (and therefore `this`) has finished initializing. If
    // that callback touches `this` too early it throws, Disposer swallows the
    // rejection, and `disposed` resolves without `disposing`/`disposed` ever
    // having fired or the handling transport ever having been torn down.
    // Assert on the actual teardown, not on the absence of a console warning.
    await server.disposed

    expect(disposing).toHaveBeenCalledTimes(1)
    expect(disposed).toHaveBeenCalledTimes(1)

    // Server.dispose()'s graceful path awaits `handling.transport.dispose()` for
    // every handled transport, so this also proves the handling transport itself
    // actually tore down rather than Server's outer dispose merely resolving
    // while the underlying transport silently failed to dispose.
    await transports.server.disposed

    await transports.dispose()
  })
})
