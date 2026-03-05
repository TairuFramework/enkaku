import { createCapability } from '@enkaku/capability'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity, stringifyToken } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'request',
    input: { type: 'string' },
    output: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Server verifyToken hook', () => {
  test('verifyToken hook is called during capability check', async () => {
    const serverSigner = randomIdentity()
    const delegatorSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const verifyToken = vi.fn()

    const handlers = {
      test: vi.fn(async () => 'ok'),
    } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    // Allow the delegator's DID so that the client must prove delegation
    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessControl: { '*': [delegatorSigner.id] },
      verifyToken,
      transport: transports.server,
    })

    // Delegator creates a capability for the client
    const capability = await createCapability(delegatorSigner, {
      sub: delegatorSigner.id,
      aud: clientSigner.id,
      act: '*',
      res: '*',
    })

    // Client sends a request using the delegated capability
    const msg = await clientSigner.signToken({
      typ: 'request',
      prc: 'test',
      rid: 'r1',
      prm: 'hello',
      aud: serverSigner.id,
      sub: delegatorSigner.id,
      cap: stringifyToken(capability),
    } as const)
    await transports.client.write(msg)

    // Wait for response
    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')

    expect(verifyToken).toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('verifyToken hook rejection prevents handler execution', async () => {
    const serverSigner = randomIdentity()
    const delegatorSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const verifyToken = vi.fn(() => {
      throw new Error('Token revoked')
    })

    const handler = vi.fn(async () => 'ok')
    const handlers = { test: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      accessControl: { '*': [delegatorSigner.id] },
      verifyToken,
      transport: transports.server,
    })

    // Delegator creates a capability for the client
    const capability = await createCapability(delegatorSigner, {
      sub: delegatorSigner.id,
      aud: clientSigner.id,
      act: '*',
      res: '*',
    })

    const msg = await clientSigner.signToken({
      typ: 'request',
      prc: 'test',
      rid: 'r1',
      prm: 'hello',
      aud: serverSigner.id,
      sub: delegatorSigner.id,
      cap: stringifyToken(capability),
    } as const)
    await transports.client.write(msg)

    // Should get error response
    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')

    // Handler should not have been called
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })
})
