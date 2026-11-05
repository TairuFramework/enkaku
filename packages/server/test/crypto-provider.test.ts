import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { createCapability } from '@kokuin/capability'
import { type CryptoProvider, nobleCrypto, type VerifyItem } from '@kokuin/crypto'
import {
  CODECS,
  createInMemoryDIDCache,
  getDID,
  randomIdentity,
  type SigningIdentity,
  stringifyToken,
} from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, Server, serve } from '../src/index.js'

const protocol = {
  test: { type: 'request', param: { type: 'string' }, result: { type: 'string' } },
  chat: {
    type: 'channel',
    param: { type: 'string' },
    send: { type: 'string' },
    receive: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol
type Transports = DirectTransports<AnyServerMessageOf<Protocol>, AnyClientMessageOf<Protocol>>

type TrackedProvider = CryptoProvider & { verified: Array<VerifyItem> }

function tracked(verify?: (item: VerifyItem) => Promise<boolean>): TrackedProvider {
  const verified: Array<VerifyItem> = []
  const check = async (item: VerifyItem) => {
    verified.push({ ...item, message: item.message.slice(), publicKey: item.publicKey.slice() })
    return await (verify ?? nobleCrypto.verify)(item)
  }
  return {
    ...nobleCrypto,
    verified,
    verify: check,
    verifyBatch: (items) => Promise.all(items.map(check)),
  }
}

function typOf(item: VerifyItem): unknown {
  const [, payload] = new TextDecoder().decode(item.message).split('.')
  return JSON.parse(Buffer.from(payload as string, 'base64url').toString()).typ
}

function isKey(item: VerifyItem, identity: SigningIdentity): boolean {
  return Buffer.compare(item.publicKey, identity.publicKey) === 0
}

function createTransports(): Transports {
  return new DirectTransports() as Transports
}

function handlersFor(): ProcedureHandlers<Protocol> {
  return {
    test: vi.fn(async () => 'ok'),
    chat: vi.fn(async ({ readable }: { readable: ReadableStream<string> }) => {
      for await (const _ of readable) {
        // drain
      }
      return 'done'
    }),
  } as unknown as ProcedureHandlers<Protocol>
}

async function signRequest(
  signer: SigningIdentity,
  aud: string,
  extra: Record<string, unknown> = {},
) {
  const token = await signer.signToken({
    payload: {
      typ: 'request',
      prc: 'test',
      rid: 'r1',
      prm: 'hello',
      aud,
      iat: Math.floor(Date.now() / 1000),
      jti: `jti-${Math.random()}`,
      ...extra,
    },
  })
  return token as unknown as AnyClientMessageOf<Protocol>
}

async function roundTrip(transports: Transports, message: AnyClientMessageOf<Protocol>) {
  await transports.client.write(message)
  const response = await transports.client.read()
  return response.value?.payload as { typ: string; code?: string } | undefined
}

describe('Server crypto provider', () => {
  test('ingress verifies the signature through the provider, over the raw message', async () => {
    const serverIdentity = randomIdentity()
    const client = randomIdentity()
    const crypto = tracked()
    const transports = createTransports()
    const server = serve<Protocol>({
      crypto,
      handlers: handlersFor(),
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: transports.server,
    })

    const message = await signRequest(client, serverIdentity.id)
    const reply = await roundTrip(transports, message)

    expect(reply?.typ).toBe('result')
    expect(crypto.verified).toHaveLength(1)
    const [item] = crypto.verified as [VerifyItem]
    expect(item.alg).toBe('EdDSA')
    expect(isKey(item, client)).toBe(true)
    expect(new TextDecoder().decode(item.message)).toBe(
      (message as unknown as { data: string }).data,
    )

    await server.dispose()
    await transports.dispose()
  })

  test('a rejecting provider refuses what another provider accepted, sharing a DID cache', async () => {
    const serverIdentity = randomIdentity()
    const client = randomIdentity()
    const cache = createInMemoryDIDCache()
    const message = await signRequest(client, serverIdentity.id)

    const acceptTransports = createTransports()
    const accepting = serve<Protocol>({
      cache,
      crypto: tracked(),
      handlers: handlersFor(),
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: acceptTransports.server,
    })
    expect((await roundTrip(acceptTransports, message))?.typ).toBe('result')

    const handlers = handlersFor()
    const rejectTransports = createTransports()
    const rejecting = serve<Protocol>({
      cache,
      crypto: tracked(async () => false),
      handlers,
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: rejectTransports.server,
    })
    const reply = await roundTrip(rejectTransports, message)

    expect(reply?.typ).toBe('error')
    expect(reply?.code).toBe('EK02')
    expect(handlers.test).not.toHaveBeenCalled()

    await accepting.dispose()
    await rejecting.dispose()
    await acceptTransports.dispose()
    await rejectTransports.dispose()
  })

  test('a provider failure surfaces as its own cause, and the same message can retry', async () => {
    const serverIdentity = randomIdentity()
    const client = randomIdentity()
    const sentinel = new Error('provider unavailable')
    let failing = true
    const crypto = tracked(async (item) => {
      if (failing) throw sentinel
      return await nobleCrypto.verify(item)
    })
    const transports = createTransports()
    const handlers = handlersFor()
    const server = serve<Protocol>({
      crypto,
      handlers,
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: transports.server,
    })
    const errors: Array<unknown> = []
    server.events.on('handlerError', ({ error }) => {
      errors.push(error.cause)
    })

    const message = await signRequest(client, serverIdentity.id)
    expect((await roundTrip(transports, message))?.typ).toBe('error')
    expect(handlers.test).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(errors).toEqual([sentinel]))
    expect(errors[0]).toBe(sentinel)

    failing = false
    expect((await roundTrip(transports, message))?.typ).toBe('result')

    await server.dispose()
    await transports.dispose()
  })

  test('channel send and abort verify through the provider', async () => {
    const serverIdentity = randomIdentity()
    const client = randomIdentity()
    const crypto = tracked(async (item) => {
      return typOf(item) === 'channel' ? await nobleCrypto.verify(item) : false
    })
    const transports = createTransports()
    const handlers = handlersFor()
    const server = serve<Protocol>({
      crypto,
      handlers,
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: transports.server,
    })
    const base = { aud: serverIdentity.id, iat: Math.floor(Date.now() / 1000) }

    const open = await client.signToken({
      payload: { ...base, typ: 'channel', prc: 'chat', rid: 'c1', prm: 'hi', jti: 'open' },
    })
    await transports.client.write(open as unknown as AnyClientMessageOf<Protocol>)
    await vi.waitFor(() => expect(handlers.chat).toHaveBeenCalledTimes(1))

    const send = await client.signToken({
      payload: { ...base, typ: 'send', prc: 'chat', rid: 'c1', val: 'x', jti: 'send' },
    })
    await transports.client.write(send as unknown as AnyClientMessageOf<Protocol>)
    let response = await transports.client.read()
    expect(response.value?.payload).toMatchObject({ typ: 'error', code: 'EK02', rid: 'c1' })

    const abort = await client.signToken({
      payload: { ...base, typ: 'abort', rid: 'c1', rsn: 'stop', jti: 'abort' },
    })
    await transports.client.write(abort as unknown as AnyClientMessageOf<Protocol>)
    response = await transports.client.read()
    expect(response.value?.payload).toMatchObject({ typ: 'error', code: 'EK02', rid: 'c1' })
    expect(crypto.verified.map(typOf)).toEqual(['channel', 'send', 'abort'])

    await server.dispose()
    await transports.dispose()
  })

  test.each([
    ['an allow-listed delegator', false],
    ['the server as subject', true],
  ])('capability chains from %s verify through the provider', async (_, serverIsSubject) => {
    const serverIdentity = randomIdentity()
    const delegator = serverIsSubject ? serverIdentity : randomIdentity()
    const client = randomIdentity()
    const capability = await createCapability({
      signer: delegator,
      payload: { sub: delegator.id, aud: client.id, act: '*', res: '*' },
    })
    const message = await signRequest(client, serverIdentity.id, {
      sub: delegator.id,
      cap: stringifyToken(capability),
    })

    const crypto = tracked(async (item) => {
      return isKey(item, delegator) ? false : await nobleCrypto.verify(item)
    })
    const transports = createTransports()
    const handlers = handlersFor()
    const server = serve<Protocol>({
      crypto,
      handlers,
      identity: serverIdentity,
      accessRules: { '*': { allow: [delegator.id] } },
      transport: transports.server,
    })

    const reply = await roundTrip(transports, message)
    expect(reply?.typ).toBe('error')
    expect(handlers.test).not.toHaveBeenCalled()
    expect(crypto.verified.some((item) => isKey(item, delegator))).toBe(true)

    await server.dispose()
    await transports.dispose()
  })

  test('handle() overrides keep the provider, and later option changes do not reach it', async () => {
    const serverIdentity = randomIdentity()
    const client = randomIdentity()
    const crypto = tracked()
    const params = {
      crypto: crypto as CryptoProvider,
      handlers: handlersFor(),
      identity: serverIdentity,
    }
    const server = new Server<Protocol>(params)
    params.crypto = tracked(async () => false)

    const transports = createTransports()
    server.handle(transports.server, { accessRules: { '*': { allow: true } } })
    const reply = await roundTrip(transports, await signRequest(client, serverIdentity.id))

    expect(reply?.typ).toBe('result')
    expect(crypto.verified).toHaveLength(1)

    await server.dispose()
    await transports.dispose()
  })

  test('the default provider refuses a small-order signature a permissive one accepts', async () => {
    const serverIdentity = randomIdentity()
    // The Ed25519 identity point as A and R with s = 0 satisfies the cofactored ZIP-215 equation.
    const smallOrder = new Uint8Array(32)
    smallOrder[0] = 1
    const signature = new Uint8Array(64)
    signature[0] = 1
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const header = { typ: 'JWT', alg: 'EdDSA' }
    const payload = {
      iss: getDID({ codec: CODECS.EdDSA, publicKey: smallOrder }),
      typ: 'request',
      prc: 'test',
      rid: 'r1',
      prm: 'hello',
      aud: serverIdentity.id,
      iat: Math.floor(Date.now() / 1000),
      jti: 'small-order',
    }
    const message = {
      header,
      payload,
      signature: Buffer.from(signature).toString('base64url'),
      data: `${encode(header)}.${encode(payload)}`,
    } as unknown as AnyClientMessageOf<Protocol>

    const permissiveTransports = createTransports()
    const permissive = serve<Protocol>({
      crypto: tracked(async () => true),
      handlers: handlersFor(),
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: permissiveTransports.server,
    })
    expect((await roundTrip(permissiveTransports, message))?.typ).toBe('result')

    const strictTransports = createTransports()
    const strict = serve<Protocol>({
      handlers: handlersFor(),
      identity: serverIdentity,
      accessRules: { '*': { allow: true } },
      transport: strictTransports.server,
    })
    const reply = await roundTrip(strictTransports, message)
    expect(reply).toMatchObject({ typ: 'error', code: 'EK02' })

    await permissive.dispose()
    await strict.dispose()
    await permissiveTransports.dispose()
    await strictTransports.dispose()
  })
})
