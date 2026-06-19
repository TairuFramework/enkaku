import { describe, expect, test } from 'vitest'

import { defineGroupProtocol } from '../src/protocol.js'

describe('defineGroupProtocol', () => {
  test('returns the protocol definition unchanged and preserves keys', () => {
    const protocol = defineGroupProtocol({
      'group/ping': { type: 'event' },
      'group/catchup': {
        type: 'request',
        param: { type: 'object', properties: { since: { type: 'number' } } },
        result: { type: 'object' },
      },
    })
    expect(Object.keys(protocol)).toEqual(['group/ping', 'group/catchup'])
    expect(protocol['group/ping'].type).toBe('event')
  })
})
