import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { createUnsignedToken, randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('Event auth error', () => {
  test('emits handlerError with category auth when event authorization fails', async () => {
    const protocol = {
      notify: {
        type: 'event',
        data: { type: 'object' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const signer = randomIdentity()
    const handler = vi.fn()
    const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: signer,
      accessRules: { notify: { allow: true } },
      transport: transports.server,
    })
    const handlerErrorEvent = server.events.once('handlerError')

    await transports.client.write(
      createUnsignedToken({
        typ: 'event',
        prc: 'notify',
        data: 'hello',
      }) as unknown as AnyClientMessageOf<Protocol>,
    )

    const emitted = await handlerErrorEvent
    expect(handler).not.toHaveBeenCalled()
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'event',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('does not emit handlerError for valid signed events', async () => {
    const protocol = {
      notify: {
        type: 'event',
        data: { type: 'object' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

    const expiresAt = Math.floor(Date.now() / 1000) + 300
    const signer = randomIdentity()
    const handler = vi.fn()
    const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const handlerErrorHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: signer,
      accessRules: { notify: { allow: true } },
      transport: transports.server,
    })
    server.events.on('handlerError', handlerErrorHandler)

    // Send valid signed event
    const message = await signer.signToken({
      typ: 'event',
      aud: signer.id,
      prc: 'notify',
      data: 'hello',
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    await server.dispose()
    await transports.dispose()

    // Handler should have been called
    expect(handler).toHaveBeenCalled()

    // No handlerError should have been emitted
    expect(handlerErrorHandler).not.toHaveBeenCalled()
  })
})
