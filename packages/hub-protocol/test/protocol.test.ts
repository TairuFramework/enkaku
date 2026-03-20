import { Client } from '@enkaku/client'
import type { ProcedureHandlers } from '@enkaku/server'
import { describe, expect, test } from 'vitest'

import type { HubProtocol } from '../src/protocol.js'

describe('HubProtocol types', () => {
  test('protocol type is assignable', () => {
    // Verify the protocol type produces correct handler types
    type Handlers = ProcedureHandlers<HubProtocol>
    // If this compiles, the protocol types are correct
    const _check: Handlers extends Record<string, unknown> ? true : false = true
    expect(_check).toBe(true)
  })
})
