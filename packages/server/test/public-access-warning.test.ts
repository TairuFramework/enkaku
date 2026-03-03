import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, Server } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

function createMockLogger() {
  const warnSpy = vi.fn()
  const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
    getChild: vi.fn().mockReturnThis(),
    with: vi.fn().mockReturnThis(),
  }
  return { logger, warnSpy }
}

describe('Public mode access control warning', () => {
  test('warns when public mode is combined with access records (no identity)', () => {
    const { logger, warnSpy } = createMockLogger()

    new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: true,
      access: { test: ['did:key:abc'] },
      logger: logger as never,
      protocol,
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('access control records are ignored'),
    )
  })

  test('does not warn when public mode has no access records (no identity)', () => {
    const { logger, warnSpy } = createMockLogger()

    new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: true,
      logger: logger as never,
      protocol,
    })

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('access control records are ignored'),
    )
  })

  test('does not warn when public mode has empty access records', () => {
    const { logger, warnSpy } = createMockLogger()

    new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: true,
      access: {},
      logger: logger as never,
      protocol,
    })

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('access control records are ignored'),
    )
  })

  test('warns when public mode is combined with access records (with identity)', () => {
    const { logger, warnSpy } = createMockLogger()
    const signer = randomIdentity()

    new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: true,
      identity: signer,
      access: { test: ['did:key:abc'] },
      logger: logger as never,
      protocol,
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('access control records are ignored'),
    )
  })

  test('does not warn when not in public mode (with identity)', () => {
    const { logger, warnSpy } = createMockLogger()
    const signer = randomIdentity()

    new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: false,
      identity: signer,
      access: { test: ['did:key:abc'] },
      logger: logger as never,
      protocol,
    })

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('access control records are ignored'),
    )
  })

  test('warns in handle() when transport handler is public with access records', async () => {
    const { logger, warnSpy } = createMockLogger()
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: true,
      logger: logger as never,
      protocol,
    })

    // Clear any constructor warnings
    warnSpy.mockClear()

    // Call handle() with access records override on a public server
    server.handle(transports.server, { access: { test: ['did:key:abc'] } })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Transport handler is in public mode'),
    )

    await server.dispose()
    await transports.dispose()
  })

  test('does not warn in handle() when transport handler is public without access records', async () => {
    const { logger, warnSpy } = createMockLogger()
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = new Server<Protocol>({
      handlers: { test: vi.fn() } as ProcedureHandlers<Protocol>,
      public: true,
      logger: logger as never,
      protocol,
    })

    // Clear any constructor warnings
    warnSpy.mockClear()

    // Call handle() without access records
    server.handle(transports.server)

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Transport handler is in public mode'),
    )

    await server.dispose()
    await transports.dispose()
  })
})
