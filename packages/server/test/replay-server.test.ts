import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { expect, test, vi } from 'vitest'

import {
  MemoryReplayCache,
  type ProcedureHandlers,
  type ReplayCache,
  Server,
  serve,
} from '../src/index.js'

const protocol = {
  notify: { type: 'event', data: { type: 'object' } },
  chat: {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
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

test('rejects a replayed signed channel send with EK09', async () => {
  const expiresAt = nowSeconds() + 300
  const signer = randomIdentity()
  const receivedValues: Array<unknown> = []
  const handler = vi.fn(async (ctx) => {
    for await (const value of ctx.readable) {
      receivedValues.push(value)
    }
    return 'done'
  })
  const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { chat: { allow: true } },
    transport: transports.server,
  })

  // Establish the channel with a valid signed token.
  const channelMsg = await signer.signToken({
    typ: 'channel',
    aud: signer.id,
    prc: 'chat',
    rid: 'send-replay',
    prm: undefined,
    exp: expiresAt,
  } as const)
  await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
  await new Promise((resolve) => setTimeout(resolve, 50))

  // Signed send from the channel owner, with a unique jti + future exp for a
  // deterministic dedup key.
  const sendMsg = await signer.signToken({
    typ: 'send',
    rid: 'send-replay',
    val: 'hello',
    jti: 'send-replay-1',
    exp: expiresAt,
  } as const)

  await transports.client.write(sendMsg as unknown as AnyClientMessageOf<Protocol>)
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(receivedValues).toContain('hello')

  const errorEvent = server.events.once('handlerError')
  await transports.client.write(sendMsg as unknown as AnyClientMessageOf<Protocol>)

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

test('rejects a replayed signed channel abort with EK09', async () => {
  const expiresAt = nowSeconds() + 300
  const signer = randomIdentity()

  // The handler never resolves on its own -- resolution is fully controlled by the
  // test so the channel controller stays alive across both abort writes, regardless
  // of how fast the (unrelated) stream teardown from the first abort() call runs.
  let resolveHandler: (value: string) => void = () => {}
  const handlerDone = new Promise<string>((resolve) => {
    resolveHandler = resolve
  })
  const handler = vi.fn(() => handlerDone)
  const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { chat: { allow: true } },
    transport: transports.server,
  })

  // Establish the channel with a valid signed token.
  const channelMsg = await signer.signToken({
    typ: 'channel',
    aud: signer.id,
    prc: 'chat',
    rid: 'abort-replay',
    prm: undefined,
    exp: expiresAt,
  } as const)
  await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
  await new Promise((resolve) => setTimeout(resolve, 50))

  // Signed abort from the channel owner, with a unique jti + future exp for a
  // deterministic dedup key.
  const abortMsg = await signer.signToken({
    typ: 'abort',
    rid: 'abort-replay',
    rsn: 'Close',
    jti: 'abort-replay-1',
    exp: expiresAt,
  } as const)

  const aborted = vi.fn()
  server.events.on('handlerAbort', aborted)

  await transports.client.write(abortMsg as unknown as AnyClientMessageOf<Protocol>)
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(aborted).toHaveBeenCalledWith({ rid: 'abort-replay', reason: 'Close' })

  const errorEvent = server.events.once('handlerError')
  await transports.client.write(abortMsg as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({ code: 'EK09' }),
      category: 'auth',
    }),
  )

  resolveHandler('done')
  await server.dispose()
  await transports.dispose()
})

test('rejects a replayed abort even after its target controller is gone', async () => {
  const expiresAt = nowSeconds() + 300
  const signer = randomIdentity()

  // Draining handler returns once the channel is aborted, so the controller is
  // deleted before the replayed abort arrives -- exercising the path where the
  // replay check must run before the controller-existence lookup.
  const handler = vi.fn(async (ctx) => {
    for await (const _value of ctx.readable) {
      // drain until abort closes the stream
    }
    return 'done'
  })
  const handlers = { chat: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  const server = serve<Protocol>({
    handlers,
    identity: signer,
    accessRules: { chat: { allow: true } },
    transport: transports.server,
  })

  const channelMsg = await signer.signToken({
    typ: 'channel',
    aud: signer.id,
    prc: 'chat',
    rid: 'abort-gone',
    prm: undefined,
    exp: expiresAt,
  } as const)
  await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)
  await new Promise((resolve) => setTimeout(resolve, 50))

  const abortMsg = await signer.signToken({
    typ: 'abort',
    rid: 'abort-gone',
    rsn: 'Close',
    jti: 'abort-gone-1',
    exp: expiresAt,
  } as const)

  const aborted = vi.fn()
  server.events.on('handlerAbort', aborted)

  // First abort is accepted and tears the controller down.
  await transports.client.write(abortMsg as unknown as AnyClientMessageOf<Protocol>)
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(aborted).toHaveBeenCalledWith({ rid: 'abort-gone', reason: 'Close' })

  // Replaying the identical abort must still surface EK09, even though the
  // controller it targets no longer exists.
  const errorEvent = server.events.once('handlerError')
  await transports.client.write(abortMsg as unknown as AnyClientMessageOf<Protocol>)

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

test('does not treat a reused jti from a different issuer as a replay', async () => {
  const signerA = randomIdentity()
  const signerB = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()
  const errorHandler = vi.fn()

  // Server authenticates but allows any issuer for `notify`.
  const server = serve<Protocol>({
    handlers,
    identity: signerA,
    accessRules: { notify: { allow: true } },
    transport: transports.server,
  })
  server.events.on('handlerError', errorHandler)

  // Two distinct issuers deliberately reuse the SAME jti value. The dedup key is
  // namespaced by issuer, so the second must NOT be rejected as a replay.
  const messageA = await signerA.signToken({
    typ: 'event',
    aud: signerA.id,
    prc: 'notify',
    data: 'from-a',
    jti: 'shared-jti',
    exp: nowSeconds() + 300,
  } as const)
  const messageB = await signerB.signToken({
    typ: 'event',
    aud: signerA.id,
    prc: 'notify',
    data: 'from-b',
    jti: 'shared-jti',
    exp: nowSeconds() + 300,
  } as const)

  await transports.client.write(messageA as unknown as AnyClientMessageOf<Protocol>)
  await transports.client.write(messageB as unknown as AnyClientMessageOf<Protocol>)

  await server.dispose()
  await transports.dispose()

  expect(handler).toHaveBeenCalledTimes(2)
  expect(errorHandler).not.toHaveBeenCalled()
})

test('delegates the dedup decision to a custom cache', async () => {
  const signer = randomIdentity()
  const handler = vi.fn()
  const handlers = { notify: handler } as unknown as ProcedureHandlers<Protocol>
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >()

  // A custom cache that reports every key as already-seen. If the server truly
  // delegates the dedup decision, even the first message is rejected with EK09.
  const seen: Array<string> = []
  const cache: ReplayCache = {
    checkAndRecord(key: string): boolean {
      seen.push(key)
      return false
    },
  }

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
    jti: 'evt-delegate',
    exp: nowSeconds() + 300,
  } as const)

  const errorEvent = server.events.once('handlerError')
  await transports.client.write(message as unknown as AnyClientMessageOf<Protocol>)

  const emitted = await errorEvent
  expect(emitted).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({ code: 'EK09' }),
      category: 'auth',
    }),
  )
  expect(handler).not.toHaveBeenCalled()
  expect(seen).toHaveLength(1)
  expect(seen[0]).toContain('evt-delegate')

  await server.dispose()
  await transports.dispose()
})
