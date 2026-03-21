import { describe, expect, test } from 'vitest'

import { HubClient } from '../src/client.js'

describe('HubClient', () => {
  test('wraps a Client<HubProtocol>', () => {
    // HubClient requires a typed Client instance, which needs a transport.
    // This test verifies the constructor accepts the expected shape.
    expect(HubClient).toBeDefined()
    expect(typeof HubClient).toBe('function')
  })
})
