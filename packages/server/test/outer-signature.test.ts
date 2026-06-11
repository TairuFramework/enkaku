import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import {
  createIdentity,
  createInMemoryDIDCache,
  getPeer4ShortForm,
  isPeer4,
  randomIdentity,
} from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'request',
    param: { type: 'string' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const expiresAt = Math.floor(Date.now() / 1000) + 300

/** base64url-encode a Uint8Array without padding */
function toB64U(bytes: Uint8Array): string {
  const bin = Array.from(bytes, (b) => String.fromCodePoint(b)).join('')
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

describe('outer-message signature verification', () => {
  test('forged signature (valid structure, bad sig bytes) is rejected with EK02', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const handlers = {
      test: async () => 'ok',
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { test: { allow: true } },
      transport: transports.server,
    })

    // Get a real valid token to steal header/payload/data from, then replace signature
    const realToken = await clientSigner.signToken({
      typ: 'request',
      prc: 'test',
      rid: 'r-forged',
      prm: 'hello',
      aud: serverSigner.id,
      exp: expiresAt,
    } as unknown as Record<string, unknown>)

    // Replace the real signature with 64 random bytes — NOT a valid ed25519 signature
    const fakeSignature = toB64U(crypto.getRandomValues(new Uint8Array(64)))

    const forgedMessage = {
      header: realToken.header,
      payload: realToken.payload,
      data: realToken.data,
      signature: fakeSignature,
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

    await server.dispose()
    await transports.dispose()
  })

  test('message without data field recomputes data and verifies successfully', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const handlers = {
      test: async () => 'ok',
    } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { test: { allow: true } },
      transport: transports.server,
    })

    // Get a real signed token, then strip the data field.
    // verifyToken now recomputes data from canonical-JSON header+payload when data is absent,
    // so the signature still verifies and the handler runs successfully.
    const realToken = await clientSigner.signToken({
      iss: clientSigner.id,
      aud: serverSigner.id,
      prc: 'test',
      rid: 'r-nodata',
      typ: 'request',
      prm: 'hello',
      exp: expiresAt,
    } as unknown as Record<string, unknown>)
    const messageWithoutData = {
      header: realToken.header,
      payload: realToken.payload,
      signature: realToken.signature,
      // data intentionally omitted — verifyToken recomputes it from header+payload
    }

    await transports.client.write(messageWithoutData as unknown as AnyClientMessageOf<Protocol>)

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')

    await server.dispose()
    await transports.dispose()
  })

  test('properly signed did:key message is accepted', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const handler = async () => 'ok'
    const handlers = { test: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { test: { allow: true } },
      transport: transports.server,
    })

    const msg = await clientSigner.signToken({
      typ: 'request',
      prc: 'test',
      rid: 'r-valid-key',
      prm: 'hello',
      aud: serverSigner.id,
      exp: expiresAt,
    } as const)

    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')

    await server.dispose()
    await transports.dispose()
  })

  test('did:peer:4 long-form message is accepted and short form is cached', async () => {
    const serverSigner = randomIdentity()

    // Create a did:peer:4 identity
    const peer4Identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    expect(isPeer4(peer4Identity.id)).toBe(true)

    const handler = async () => 'ok'
    const handlers = { test: handler } as unknown as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const cache = createInMemoryDIDCache()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessRules: { test: { allow: true } },
      cache,
      transport: transports.server,
    })

    // Use embedLongForm: true so the long form (self-contained) is included in iss
    const msg = await peer4Identity.signToken(
      {
        typ: 'request',
        prc: 'test',
        rid: 'r-peer4',
        prm: 'hello',
        aud: serverSigner.id,
        exp: expiresAt,
      },
      { embedLongForm: true },
    )

    await transports.client.write(msg as unknown as AnyClientMessageOf<Protocol>)

    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')

    // After successful verification, the short form should be in the cache
    const shortForm = getPeer4ShortForm(peer4Identity.id)
    const cached = await cache.get(shortForm)
    expect(cached).toBeDefined()

    await server.dispose()
    await transports.dispose()
  })
})
