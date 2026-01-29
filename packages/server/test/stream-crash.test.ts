import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Stream crash cleanup', () => {
  test('stream writable is closed when handler throws', async () => {
    const protocol = {
      failing: {
        type: 'stream',
        receive: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn(async () => {
      throw new Error('handler crashed')
    })
    const handlers = { failing: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const errorHandler = vi.fn()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
    })
    server.events.on('handlerError', errorHandler)

    await transports.client.write(
      createUnsignedToken({ typ: 'stream', prc: 'failing', rid: 's1', prm: undefined }),
    )

    // Read the error response
    const msg = await transports.client.read()
    expect(msg.value?.payload.typ).toBe('error')
    expect(msg.value?.payload.rid).toBe('s1')

    // Handler error event should have been emitted
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(errorHandler).toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('channel writable is closed when handler throws', async () => {
    const protocol = {
      failing: {
        type: 'channel',
        send: { type: 'string' },
        receive: { type: 'string' },
        result: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const handler = vi.fn(async () => {
      throw new Error('handler crashed')
    })
    const handlers = { failing: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const errorHandler = vi.fn()
    const server = serve<Protocol>({
      handlers,
      public: true,
      transport: transports.server,
    })
    server.events.on('handlerError', errorHandler)

    await transports.client.write(
      createUnsignedToken({ typ: 'channel', prc: 'failing', rid: 'c1', prm: undefined }),
    )

    // Read the error response
    const msg = await transports.client.read()
    expect(msg.value?.payload.typ).toBe('error')
    expect(msg.value?.payload.rid).toBe('c1')

    // Handler error event should have been emitted
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(errorHandler).toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })
})
