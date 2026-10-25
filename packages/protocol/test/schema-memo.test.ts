import { describe, expect, test } from 'vitest'

import {
  createClientMessageSchema,
  createServerMessageSchema,
  type ProtocolDefinition,
} from '../src/index.js'

function createProtocol() {
  return {
    'test/request': { type: 'request', param: { type: 'number' }, result: { type: 'string' } },
    'test/channel': {
      type: 'channel',
      param: { type: 'number' },
      send: { type: 'string' },
      receive: { type: 'number' },
    },
  } as const satisfies ProtocolDefinition
}

describe('message schema memoization', () => {
  test('createClientMessageSchema() returns the same instance per protocol and type', () => {
    const protocol = createProtocol()
    const schema = createClientMessageSchema(protocol)
    expect(createClientMessageSchema(protocol)).toBe(schema)
    // Default type is 'any'
    expect(createClientMessageSchema(protocol, 'any')).toBe(schema)
    expect(createClientMessageSchema(protocol, 'signed')).not.toBe(schema)
    expect(createClientMessageSchema(protocol, 'signed')).toBe(
      createClientMessageSchema(protocol, 'signed'),
    )
    expect(createClientMessageSchema(createProtocol())).not.toBe(schema)
    expect(createClientMessageSchema(createProtocol())).toEqual(schema)
  })

  test('createServerMessageSchema() returns the same instance per protocol and type', () => {
    const protocol = createProtocol()
    const schema = createServerMessageSchema(protocol)
    expect(createServerMessageSchema(protocol)).toBe(schema)
    expect(createServerMessageSchema(protocol, 'any')).toBe(schema)
    expect(createServerMessageSchema(protocol, 'unsigned')).not.toBe(schema)
    expect(createServerMessageSchema(createProtocol())).not.toBe(schema)
  })
})
