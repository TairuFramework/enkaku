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

describe('Server accessControl configuration', () => {
  test('throws when no identity and no accessControl', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol })
    }).toThrow('"identity" must be provided or "accessControl" must be set to false')
  })

  test('throws when no identity and accessControl: true', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol, accessControl: true })
    }).toThrow('"identity" must be provided or "accessControl" must be set to false')
  })

  test('throws when no identity and accessControl is a record', () => {
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        accessControl: { test: ['did:key:abc'] },
      })
    }).toThrow('"identity" must be provided or "accessControl" must be set to false')
  })

  test('allows no identity with accessControl: false', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol, accessControl: false })
    }).not.toThrow()
  })

  test('defaults to server-only access when identity provided without accessControl', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({ handlers, protocol, identity: signer })
    }).not.toThrow()
  })

  test('allows identity with accessControl: false (public with identity)', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({ handlers, protocol, identity: signer, accessControl: false })
    }).not.toThrow()
  })

  test('allows identity with accessControl record', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        identity: signer,
        accessControl: { test: ['did:key:abc'] },
      })
    }).not.toThrow()
  })

  test('handle() rejects accessControl override requiring auth when server has no identity', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = new Server<Protocol>({
      handlers,
      protocol,
      accessControl: false,
    })

    await expect(
      server.handle(transports.server, { accessControl: { test: ['did:key:abc'] } }),
    ).rejects.toThrow('identity is required')

    await server.dispose()
    await transports.dispose()
  })
})
