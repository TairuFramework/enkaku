import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { expect, test, vi } from 'vitest'

import { MemoryReplayCache, type ProcedureHandlers, Server, serve } from '../src/index.js'

const protocol = {
  notify: { type: 'event', data: { type: 'object' } },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

test('rejects a replayed signed event with EK09', async () => {
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

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-1',
    exp: nowSeconds() + 300,
  } as const)

  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)
  const errorEvent = server.events.once('handlerError')
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({ code: 'EK09' }),
      category: 'auth',
    }),
  )

  await server.dispose()
  await transports.dispose()
})

test('rejects a replay across two connections to the same server', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const t1 = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()
  const t2 = new DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>()

  const server = new Server<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transports: [t1.server, t2.server],
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-cross',
    exp: nowSeconds() + 300,
  } as const)

  await t1.client.write(message as unknown as AnyClientMessageOf<Protocol>)
  const errorEvent = server.events.once('handlerError')
  await t2.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(
    expect.objectContaining({ error: expect.objectContaining({ code: 'EK09' }) }),
  )

  await server.dispose()
  await t1.dispose()
  await t2.dispose()
})

test('rejects a stale message (no exp, old iat) when rejectStale is on', async () => {
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
    replay: { maxAge: 1_000 },
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-stale',
    iat: nowSeconds() - 300, // 300s old, far beyond 1s maxAge; no exp
  } as const)

  const errorEvent = server.events.once('handlerError')
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(
    expect.objectContaining({ error: expect.objectContaining({ code: 'EK09' }) }),
  )
  expect(handler).not.toHaveBeenCalled()

  await server.dispose()
  await transports.dispose()
})

test('replay: { enabled: false } disables protection', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const errorHandler = vi.fn()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
    replay: { enabled: false },
  })
  server.events.on('handlerError', errorHandler)

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-off',
    exp: nowSeconds() + 300,
  } as const)

  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  await server.dispose()
  await transports.dispose()

  expect(handler).toHaveBeenCalledTimes(2)
  expect(errorHandler).not.toHaveBeenCalled()
})

test('uses a custom cache when provided', async () => {
  const signer = randomIdentity()
  const handlers = { notify: vi.fn() } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const cache = new MemoryReplayCache()
  const spy = vi.spyOn(cache, 'checkAndRecord')

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
    replay: { cache },
  })

  const message = await signer.signToken({
    typ: 'event',
    aud: signer.id,
    prc: 'notify',
    data: 'hello',
    jti: 'evt-custom',
    exp: nowSeconds() + 300,
  } as const)
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  await server.dispose()
  await transports.dispose()

  expect(spy).toHaveBeenCalled()
})
