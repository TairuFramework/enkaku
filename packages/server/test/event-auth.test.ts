import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken, randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Event auth error', () => {
  test('emits eventAuthError when event authorization fails', async () => {
    const protocol = {
      notify: {
        type: 'event',
        data: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const signer = randomIdentity()
    const handler = vi.fn()
    const handlers = { notify: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const eventAuthHandler = vi.fn()
    const handlerErrorHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: signer,
      public: false,
      access: { notify: true },
      transport: transports.server,
    })
    server.events.on('eventAuthError', eventAuthHandler)
    server.events.on('handlerError', handlerErrorHandler)

    // Send unsigned event - should fail auth
    await transports.client.write(
      createUnsignedToken({ typ: 'event', prc: 'notify', data: 'hello' }),
    )

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Handler should not have been called
    expect(handler).not.toHaveBeenCalled()

    // eventAuthError should have been emitted
    expect(eventAuthHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
      }),
    )

    // handlerError should also have been emitted
    expect(handlerErrorHandler).toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('does not emit eventAuthError for valid signed events', async () => {
    const protocol = {
      notify: {
        type: 'event',
        data: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const expiresAt = Math.floor(Date.now() / 1000) + 300
    const signer = randomIdentity()
    const handler = vi.fn()
    const handlers = { notify: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const eventAuthHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: signer,
      public: false,
      access: { notify: true },
      transport: transports.server,
    })
    server.events.on('eventAuthError', eventAuthHandler)

    // Send valid signed event
    const message = await signer.signToken({
      typ: 'event',
      aud: signer.id,
      prc: 'notify',
      data: 'hello',
      exp: expiresAt,
    } as const)
    await transports.client.write(message)

    await server.dispose()
    await transports.dispose()

    // Handler should have been called
    expect(handler).toHaveBeenCalled()

    // No auth error should have been emitted
    expect(eventAuthHandler).not.toHaveBeenCalled()
  })
})
