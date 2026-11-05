import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import {
  authorityPath,
  type ControllerLog,
  createControllerResolver,
  createInception,
  deriveKeyPair,
  didFromInception,
  encodeKey,
} from '@kokuin/controller'
import { type CryptoProvider, nobleCrypto, type VerifyItem } from '@kokuin/crypto'
import { createSigningIdentityForDID, type MethodRegistry, randomIdentity } from '@kokuin/token'
import { describe, expect, it, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  ping: {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const expiresAt = () => Math.floor(Date.now() / 1000) + 300

// Build a did:kokuin controller from a fixed seed: its inception log, the DID it names, and a signing
// identity bound to that DID using the inception head's authority key. A did:kokuin issuer cannot be
// resolved from the identifier alone -- only a MethodRegistry folding the log answers who its keys
// are -- so it exercises the `methods` option end to end where did:key / did:peer:4 would not.
async function makeController(seedFill: number) {
  const seed = new Uint8Array(32).fill(seedFill)
  const inception = await createInception({ seed, profile: 0 })
  const did = didFromInception(inception.event)
  const pair = deriveKeyPair({
    seed,
    path: authorityPath({ profile: 0, gen: 0, seq: 0 }),
    alg: 'EdDSA',
  })
  const identity = createSigningIdentityForDID({ id: did as never, privateKey: pair.privateKey })
  const kid = `#${encodeKey({ publicKey: pair.publicKey, alg: 'EdDSA' })}`
  const log: ControllerLog = { chain: [inception], events: [] }
  return { did, identity, kid, log }
}

function registryFor(did: string, log: ControllerLog, crypto?: CryptoProvider): MethodRegistry {
  return [
    createControllerResolver({
      crypto,
      loadLog: async (asked) => (asked === did ? log : undefined),
    }),
  ]
}

describe('did:kokuin support via the methods registry', () => {
  it('verifies a did:kokuin issued request when a methods registry is supplied', async () => {
    const serverIdentity = randomIdentity()
    const client = await makeController(1)
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [client.did] } },
      methods: registryFor(client.did, client.log),
      transport: transports.server,
    })

    const msg = await client.identity.signToken({
      payload: {
        typ: 'request',
        prc: 'ping',
        rid: 'r-kokuin-1',
        prm: 'hello',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      header: { kid: client.kid },
    })

    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)
    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')
    expect(handler).toHaveBeenCalledTimes(1)

    await server.dispose()
    await transports.dispose()
  })

  it.each([
    ['accepts', true, 'result'],
    ['refuses', false, 'error'],
  ])('%s a did:kokuin issued request by the resolver provider verdict', async (_, verdict, typ) => {
    const serverIdentity = randomIdentity()
    const client = await makeController(3)
    const verify = vi.fn(async (item: VerifyItem) => verdict && (await nobleCrypto.verify(item)))
    const crypto: CryptoProvider = {
      ...nobleCrypto,
      verify,
      verifyBatch: (items) => Promise.all(items.map(verify)),
    }
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    const server = serve<Protocol>({
      crypto,
      handlers: { ping: vi.fn(async () => 'pong') } as unknown as ProcedureHandlers<Protocol>,
      identity: serverIdentity,
      accessRules: { ping: { allow: [client.did] } },
      methods: registryFor(client.did, client.log, crypto),
      transport: transports.server,
    })

    const msg = await client.identity.signToken({
      payload: {
        typ: 'request',
        prc: 'ping',
        rid: 'r-kokuin-provider',
        prm: 'hello',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      header: { kid: client.kid },
    })
    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)
    const response = await transports.client.read()

    expect(response.value?.payload.typ).toBe(typ)
    expect(verify).toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  it('rejects a did:kokuin issued request when no methods registry is supplied', async () => {
    const serverIdentity = randomIdentity()
    const client = await makeController(2)
    const handler = vi.fn(async () => 'pong')
    const handlers = { ping: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverIdentity,
      accessRules: { ping: { allow: [client.did] } },
      transport: transports.server,
    })

    const msg = await client.identity.signToken({
      payload: {
        typ: 'request',
        prc: 'ping',
        rid: 'r-kokuin-2',
        prm: 'hello',
        aud: serverIdentity.id,
        exp: expiresAt(),
      },
      header: { kid: client.kid },
    })

    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)
    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })
})
