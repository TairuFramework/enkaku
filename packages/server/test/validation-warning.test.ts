import type { ProtocolDefinition } from '@enkaku/protocol'
import { describe, expect, test, vi } from 'vitest'

import { Server } from '../src/index.js'

describe('Validation warning', () => {
  test('logs warning when no protocol is provided', () => {
    const protocol = {
      test: {
        type: 'event',
        data: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

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

    new Server<Protocol>({
      handlers: { test: vi.fn() },
      public: true,
      logger: logger as never,
      // No protocol provided
    })

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('validation is disabled'))
  })

  test('does not log warning when protocol is provided', () => {
    const protocol = {
      test: {
        type: 'event',
        data: { type: 'string' },
      },
    } as const satisfies ProtocolDefinition
    type Protocol = typeof protocol

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

    new Server<Protocol>({
      handlers: { test: vi.fn() },
      public: true,
      protocol,
      logger: logger as never,
    })

    expect(warnSpy).not.toHaveBeenCalled()
  })
})
