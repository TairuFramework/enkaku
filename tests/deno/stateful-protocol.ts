import type { ProtocolDefinition } from '@enkaku/protocol'

export const protocol = {
  'example:request': {
    type: 'request',
    result: {
      type: 'object',
      properties: { test: { type: 'boolean' } },
      required: ['test'],
      additionalProperties: false,
    },
  },
  'example:stream': {
    type: 'stream',
    param: { type: 'number' },
    receive: { type: 'number' },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition

export type Protocol = typeof protocol
