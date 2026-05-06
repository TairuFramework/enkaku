import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
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
  test('builds standalone server when no identity and no accessRules', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol })
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

    const server = new Server<Protocol>({ handlers, protocol })

    await expect(
      server.handle(transports.server, {
        accessControl: { test: { allow: ['did:key:abc'] } },
      }),
    ).rejects.toThrow('identity is required')

    await server.dispose()
    await transports.dispose()
  })
})
