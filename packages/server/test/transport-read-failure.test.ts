import type { ProtocolDefinition, ServerTransportOf } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Transport read failure', () => {
  test('settles handle() and emits transportError when transport.read() rejects', async () => {
    const failingTransport = {
      read: vi.fn(() => Promise.reject(new Error('read boom'))),
      write: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(() => Promise.resolve()),
    } as unknown as ServerTransportOf<Protocol>

    const server = new Server<Protocol>({
      handlers: { test: vi.fn() },
      protocol,
      requireAuth: false,
    })
    const transportError = vi.fn()
    server.events.on('transportError', transportError)

    // Pre-fix this promise never settles (test times out)
    await expect(server.handle(failingTransport)).resolves.toBeUndefined()

    expect(transportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Transport read failed' }),
      }),
    )

    await server.dispose()
  })
})
