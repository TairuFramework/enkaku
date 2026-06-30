import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

describe('access-control denial emits handlerError', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 300

  const protocol = {
    req: { type: 'request', result: { type: 'string' } },
    chan: {
      type: 'channel',
      send: { type: 'string' },
      receive: { type: 'string' },
      result: { type: 'string' },
    },
    str: {
      type: 'stream',
      receive: { type: 'string' },
      result: { type: 'string' },
    },
  } as const satisfies ProtocolDefinition
  type Protocol = typeof protocol

  test('request denial emits handlerError with category auth, messageType request', async () => {
    const handler = vi.fn(() => 'OK')
    const handlers = { req: handler } as unknown as ProcedureHandlers<Protocol>

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { req: { allow: () => false } },
      transport: transports.server,
    })
    const handlerErrorEvent = server.events.once('handlerError')

    const message = await clientSigner.signToken({
      typ: 'request',
      aud: serverSigner.id,
      prc: 'req',
      rid: 'r1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    const read = await transports.client.read()
    expect(read.value?.payload.typ).toBe('error')
    expect((read.value?.payload as Record<string, unknown>).code).toBe('EK02')

    const emitted = await handlerErrorEvent
    expect(handler).not.toHaveBeenCalled()
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'request',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('channel denial emits handlerError with category auth, messageType channel', async () => {
    const handler = vi.fn(async () => 'OK')
    const handlers = { chan: handler } as unknown as ProcedureHandlers<Protocol>

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { chan: { allow: () => false } },
      transport: transports.server,
    })
    const handlerErrorEvent = server.events.once('handlerError')

    const message = await clientSigner.signToken({
      typ: 'channel',
      aud: serverSigner.id,
      prc: 'chan',
      rid: 'c1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    const read = await transports.client.read()
    expect(read.value?.payload.typ).toBe('error')
    expect((read.value?.payload as Record<string, unknown>).code).toBe('EK02')

    const emitted = await handlerErrorEvent
    expect(handler).not.toHaveBeenCalled()
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'channel',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('stream denial emits handlerError with category auth, messageType stream', async () => {
    const handler = vi.fn(async () => 'OK')
    const handlers = { str: handler } as unknown as ProcedureHandlers<Protocol>

    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { str: { allow: () => false } },
      transport: transports.server,
    })
    const handlerErrorEvent = server.events.once('handlerError')

    const message = await clientSigner.signToken({
      typ: 'stream',
      aud: serverSigner.id,
      prc: 'str',
      rid: 's1',
      prm: undefined,
      exp: expiresAt,
    } as const)
    await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

    const read = await transports.client.read()
    expect(read.value?.payload.typ).toBe('error')
    expect((read.value?.payload as Record<string, unknown>).code).toBe('EK02')

    const emitted = await handlerErrorEvent
    expect(handler).not.toHaveBeenCalled()
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
        messageType: 'stream',
      }),
    )

    await server.dispose()
    await transports.dispose()
  })
})
