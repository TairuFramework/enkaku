import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { DirectTransports } from '@enkaku/transport'
import { randomIdentity } from '@kokuin/token'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, Server } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const handlers = { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>

describe('Server accessRules configuration', () => {
  test('throws when neither identity nor requireAuth:false is provided', () => {
    expect(() => {
      // @ts-expect-error - a server without identity must opt out of auth explicitly
      new Server<Protocol>({ handlers, protocol })
    }).toThrow('must explicitly pass "requireAuth: false"')
  })

  test('builds standalone server when requireAuth:false is passed without identity', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol, requireAuth: false })
    }).not.toThrow()
  })

  test('throws when accessRules provided without identity', () => {
    expect(() => {
      // @ts-expect-error - accessRules requires identity at the type level
      new Server<Protocol>({
        handlers,
        protocol,
        accessRules: { test: { allow: ['did:key:abc'] } },
      })
    }).toThrow('"accessRules" requires "identity"')
  })

  test('defaults to server-only access when identity provided without accessRules', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({ handlers, protocol, identity: signer })
    }).not.toThrow()
  })

  test('allows identity with accessRules record', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        identity: signer,
        accessRules: { test: { allow: ['did:key:abc'] } },
      })
    }).not.toThrow()
  })

  test('handle() rejects accessRules override requiring auth when server has no identity', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = new Server<Protocol>({ handlers, protocol, requireAuth: false })

    await expect(
      server.handle(transports.server, {
        accessRules: { test: { allow: ['did:key:abc'] } },
      }),
    ).rejects.toThrow('identity is required')

    await server.dispose()
    await transports.dispose()
  })
})
