import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createUnsignedToken } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('handling list cleanup', () => {
  test('completed transports are removed from the handling list', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      requireAuth: false,
      handlers: { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>,
      protocol,
      transport: transports.server,
    })
    expect(server.activeTransportsCount).toBe(1)

    // Send a message to initialize the client transport stream, then close it.
    // Closing the client side ends the server read loop (done: true).
    await transports.client.write(
      createUnsignedToken({ typ: 'event', prc: 'test', data: {} }) as AnyClientMessageOf<Protocol>,
    )
    await transports.client.dispose()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(server.activeTransportsCount).toBe(0)

    await server.dispose()
    await transports.dispose()
  })
})
