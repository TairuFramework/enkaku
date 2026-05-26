import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import {
  createIdentity,
  createInMemoryDIDCache,
  type DIDDoc,
  type DIDResolver,
  getPeer4ShortForm,
  type MultiKeyIdentity,
  type OwnIdentity,
  randomIdentity,
} from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  ping: {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'string' },
  },
  chat: {
    type: 'channel',
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const expiresAt = () => Math.floor(Date.now() / 1000) + 300

/** Build a minimal b64url encoder to tamper with signatures */
function toB64U(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (b) => String.fromCodePoint(b)).join('')
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

describe('peer4 handshake integration', () => {
  // Server uses a did:key identity (OwnIdentity has .id); client uses did:peer:4
  let serverIdentity: OwnIdentity
  let clientIdentity: MultiKeyIdentity
  let clientShortForm: string

  beforeEach(async () => {
    serverIdentity = randomIdentity()
    clientIdentity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    clientShortForm = getPeer4ShortForm(clientIdentity.did)
  })

  it('Scenario A: first request long-form populates cache; second request short-form succeeds', async () => {
    const cache = createInMemoryDIDCache()
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [clientShortForm] } },
      cache,
      transport: transports.server,
    })

    // First request: long-form iss (embedLongForm: true forces it even though sentTo is empty)
    const msg1 = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-a-1',
        prm: 'hello',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: true },
    )

    await transports.client.write(msg1 as unknown as AnyClientMessageOf<Protocol>)
    const response1 = await transports.client.read()
    expect(response1.value?.payload.typ).toBe('result')

    // Cache should now contain the client's short form
    const cached = await cache.get(clientShortForm)
    expect(cached).toBeDefined()

    // Second request: short-form iss (embedLongForm: false forces short form)
    const msg2 = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-a-2',
        prm: 'hello again',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: false },
    )

    await transports.client.write(msg2 as unknown as AnyClientMessageOf<Protocol>)
    const response2 = await transports.client.read()
    expect(response2.value?.payload.typ).toBe('result')

    expect(handler).toHaveBeenCalledTimes(2)

    await server.dispose()
    await transports.dispose()
  })

  it('Scenario B: forged signature with peer4 long-form iss is rejected; cache not populated', async () => {
    const cache = createInMemoryDIDCache()
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [clientShortForm] } },
      cache,
      transport: transports.server,
    })

    // Build a valid long-form token, then replace the signature with random bytes
    const realToken = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-b-1',
        prm: 'tampered',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: true },
    )

    const forgedSignature = toB64U(crypto.getRandomValues(new Uint8Array(64)))
    const forgedMessage = {
      header: realToken.header,
      payload: realToken.payload,
      data: realToken.data,
      signature: forgedSignature,
    }

    const handlerErrorEvent = server.events.once('handlerError')
    await transports.client.write(forgedMessage as unknown as AnyClientMessageOf<Protocol>)

    const emitted = await handlerErrorEvent
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
      }),
    )

    // Security fix: bad-sig must NOT populate the cache
    const cached = await cache.get(clientShortForm)
    expect(cached).toBeUndefined()

    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  it('Scenario C: access rule with short-form; client signs with long-form; normalizeDID folds to match', async () => {
    // Server allow-list uses short form only
    const cache = createInMemoryDIDCache()
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [clientShortForm] } },
      cache,
      transport: transports.server,
    })

    // Client sends with long-form iss (first contact)
    const msg = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-c-1',
        prm: 'mixed-form',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: true },
    )

    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)
    const response = await transports.client.read()

    // normalizeDID should fold long → short, matching the allow list
    expect(response.value?.payload.typ).toBe('result')
    expect(handler).toHaveBeenCalledTimes(1)

    await server.dispose()
    await transports.dispose()
  })

  it('Scenario D: short-form without cache or resolver throws UnknownDID, surfaced as EK02', async () => {
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    // No cache, no resolver
    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [clientShortForm] } },
      transport: transports.server,
    })

    // Force short-form iss — resolver cannot resolve it
    const msg = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-d-1',
        prm: 'short-only',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: false },
    )

    const handlerErrorEvent = server.events.once('handlerError')
    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)

    const emitted = await handlerErrorEvent
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
      }),
    )
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  it('Scenario F: peer4 client opens channel (long-form), subsequent send messages (short-form) all deliver', async () => {
    const cache = createInMemoryDIDCache()
    const receivedValues: Array<unknown> = []
    const handler = vi.fn(async (ctx: { readable: AsyncIterable<string> }) => {
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
      identity: serverIdentity,
      accessRules: { chat: { allow: [clientShortForm] } },
      cache,
      transport: transports.server,
    })

    // Open channel with long-form iss (first contact, embedLongForm: true)
    const channelMsg = await clientIdentity.sign(
      {
        typ: 'channel',
        prc: 'chat',
        rid: 'ch-f-1',
        prm: undefined,
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: true },
    )
    await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)

    // Give time for channel to be established and cache populated
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Cache should now contain client's short form from the channel-open
    const cached = await cache.get(clientShortForm)
    expect(cached).toBeDefined()

    // Send first message: short-form iss (same aud was already seen; embedLongForm:false)
    const send1 = await clientIdentity.sign(
      { typ: 'send', rid: 'ch-f-1', val: 'hello-1' },
      { embedLongForm: false },
    )
    await transports.client.write(send1 as unknown as AnyClientMessageOf<Protocol>)

    // Send second message: short-form iss
    const send2 = await clientIdentity.sign(
      { typ: 'send', rid: 'ch-f-1', val: 'hello-2' },
      { embedLongForm: false },
    )
    await transports.client.write(send2 as unknown as AnyClientMessageOf<Protocol>)

    // Give time for processing
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Both values should have been received by the handler
    expect(receivedValues).toEqual(['hello-1', 'hello-2'])

    await server.dispose()
    await transports.dispose()
  })

  it('Scenario G: forged send with random signature on peer4 channel is rejected', async () => {
    const cache = createInMemoryDIDCache()
    const receivedValues: Array<unknown> = []
    const handler = vi.fn(async (ctx: { readable: AsyncIterable<string> }) => {
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
      identity: serverIdentity,
      accessRules: { chat: { allow: [clientShortForm] } },
      cache,
      transport: transports.server,
    })

    // Open channel with long-form iss to populate cache
    const channelMsg = await clientIdentity.sign(
      {
        typ: 'channel',
        prc: 'chat',
        rid: 'ch-g-1',
        prm: undefined,
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: true },
    )
    await transports.client.write(channelMsg as unknown as AnyClientMessageOf<Protocol>)

    // Give time for channel to be established
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Build a real-shaped send token with short-form iss, then replace signature with junk
    const realSend = await clientIdentity.sign(
      { typ: 'send', rid: 'ch-g-1', val: 'forged-value' },
      { embedLongForm: false },
    )
    const forgedSend = {
      header: realSend.header,
      payload: realSend.payload,
      data: realSend.data,
      signature: toB64U(crypto.getRandomValues(new Uint8Array(64))),
    }

    const handlerErrorEvent = server.events.once('handlerError')
    await transports.client.write(forgedSend as unknown as AnyClientMessageOf<Protocol>)

    const emitted = await handlerErrorEvent
    expect(emitted).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'EK02' }),
        category: 'auth',
      }),
    )
    // Forged value must NOT have reached the handler
    expect(receivedValues).toEqual([])

    await server.dispose()
    await transports.dispose()
  })

  it('Scenario E: resolver provides fallback for short-form; subsequent request skips resolver', async () => {
    const cache = createInMemoryDIDCache()
    const resolverFn = vi.fn<DIDResolver>(async (did: string) => {
      if (did === clientShortForm) return clientIdentity.doc as DIDDoc
      return undefined
    })
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [clientShortForm] } },
      cache,
      resolver: resolverFn,
      transport: transports.server,
    })

    // First request: short-form iss — resolver is invoked
    const msg1 = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-e-1',
        prm: 'first',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: false },
    )

    await transports.client.write(msg1 as unknown as AnyClientMessageOf<Protocol>)
    const response1 = await transports.client.read()
    expect(response1.value?.payload.typ).toBe('result')

    // Resolver was called exactly once
    expect(resolverFn).toHaveBeenCalledTimes(1)
    expect(resolverFn).toHaveBeenCalledWith(clientShortForm)

    // Cache should now be populated
    const cached = await cache.get(clientShortForm)
    expect(cached).toBeDefined()

    // Second request: short-form iss again — cache hit, resolver NOT called again
    const msg2 = await clientIdentity.sign(
      {
        typ: 'request',
        prc: 'ping',
        rid: 'r-e-2',
        prm: 'second',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      { embedLongForm: false },
    )

    await transports.client.write(msg2 as unknown as AnyClientMessageOf<Protocol>)
    const response2 = await transports.client.read()
    expect(response2.value?.payload.typ).toBe('result')

    // Resolver still called only once (cache served the second request)
    expect(resolverFn).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledTimes(2)

    await server.dispose()
    await transports.dispose()
  })
})
