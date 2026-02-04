import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, type RequestHandler, serve } from '../src/index.js'

describe('encryption policy enforcement', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 300

  const protocol = {
    test: {
      type: 'request',
      result: { type: 'string' },
    },
    notify: {
      type: 'event',
      data: { type: 'string' },
    },
  } as const satisfies ProtocolDefinition
  type Protocol = typeof protocol

  test('rejects request when encryptionPolicy is required and message is not encrypted', async () => {
    const handler = vi.fn<RequestHandler<Protocol, 'test'>>(() => 'OK')
    const notifyHandler = vi.fn()
    const handlers = { test: handler, notify: notifyHandler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomIdentity()
    serve<Protocol>({
      handlers,
      identity: signer,
      encryptionPolicy: 'required',
      transport: transports.server,
    })

    const message = (await signer.signToken({
      typ: 'request',
      prc: 'test',
      rid: '1',
    })) as unknown as AnyClientMessageOf<Protocol>
    await transports.client.write(message)
    const read = await transports.client.read()

    expect(read.value?.payload.typ).toBe('error')
    expect(read.value?.payload.code).toBe('EK07')
    expect(handler).not.toHaveBeenCalled()

    await transports.dispose()
  })

  test('allows request when encryptionPolicy is optional and message is not encrypted', async () => {
    const handler = vi.fn<RequestHandler<Protocol, 'test'>>(() => 'OK')
    const notifyHandler = vi.fn()
    const handlers = { test: handler, notify: notifyHandler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomIdentity()
    serve<Protocol>({
      handlers,
      identity: signer,
      encryptionPolicy: 'optional',
      transport: transports.server,
    })

    const message = (await signer.signToken({
      typ: 'request',
      prc: 'test',
      rid: '1',
    })) as unknown as AnyClientMessageOf<Protocol>
    await transports.client.write(message)
    const read = await transports.client.read()

    expect(read.value?.payload.typ).toBe('result')
    expect(read.value?.payload.val).toBe('OK')

    await transports.dispose()
  })

  test('allows request when no encryptionPolicy is set', async () => {
    const handler = vi.fn<RequestHandler<Protocol, 'test'>>(() => 'OK')
    const notifyHandler = vi.fn()
    const handlers = { test: handler, notify: notifyHandler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomIdentity()
    serve<Protocol>({
      handlers,
      identity: signer,
      transport: transports.server,
    })

    const message = (await signer.signToken({
      typ: 'request',
      prc: 'test',
      rid: '1',
    })) as unknown as AnyClientMessageOf<Protocol>
    await transports.client.write(message)
    const read = await transports.client.read()

    expect(read.value?.payload.typ).toBe('result')
    expect(read.value?.payload.val).toBe('OK')

    await transports.dispose()
  })

  test('rejects event when encryptionPolicy is required', async () => {
    const handler = vi.fn()
    const notifyHandler = vi.fn()
    const handlers = { test: handler, notify: notifyHandler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomIdentity()
    const handlerErrorHandler = vi.fn()

    const server = serve<Protocol>({
      handlers,
      identity: signer,
      encryptionPolicy: 'required',
      transport: transports.server,
    })
    server.events.on('handlerError', handlerErrorHandler)

    const message = await signer.signToken({
      typ: 'event',
      aud: signer.id,
      prc: 'notify',
      data: 'hello',
      exp: expiresAt,
    } as const)
    await transports.client.write(message)

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(notifyHandler).not.toHaveBeenCalled()
    expect(handlerErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK07' }),
      }),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('per-procedure encryption policy overrides global policy', async () => {
    const handler = vi.fn<RequestHandler<Protocol, 'test'>>(() => 'OK')
    const notifyHandler = vi.fn()
    const handlers = { test: handler, notify: notifyHandler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const signer = randomIdentity()
    serve<Protocol>({
      handlers,
      identity: signer,
      encryptionPolicy: 'required',
      access: {
        // Override: this procedure doesn't need encryption
        test: { allow: true, encryption: 'none' },
      },
      transport: transports.server,
    })

    const message = (await signer.signToken({
      typ: 'request',
      prc: 'test',
      rid: '1',
    })) as unknown as AnyClientMessageOf<Protocol>
    await transports.client.write(message)
    const read = await transports.client.read()

    expect(read.value?.payload.typ).toBe('result')
    expect(read.value?.payload.val).toBe('OK')

    await transports.dispose()
  })

  test('public server enforces encryption policy', async () => {
    const handler = vi.fn<RequestHandler<Protocol, 'test'>>(() => 'OK')
    const notifyHandler = vi.fn()
    const handlers = { test: handler, notify: notifyHandler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    serve<Protocol>({
      handlers,
      public: true,
      encryptionPolicy: 'required',
      transport: transports.server,
    })

    const signer = randomIdentity()
    const message = (await signer.signToken({
      typ: 'request',
      prc: 'test',
      rid: '1',
    })) as unknown as AnyClientMessageOf<Protocol>
    await transports.client.write(message)
    const read = await transports.client.read()

    expect(read.value?.payload.typ).toBe('error')
    expect(read.value?.payload.code).toBe('EK07')
    expect(handler).not.toHaveBeenCalled()

    await transports.dispose()
  })
})
