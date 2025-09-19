import type { ProtocolDefinition } from '@enkaku/protocol'

export const protocol = {
  sign: {
    type: 'request',
    param: {
      type: 'object',
      properties: {
        keyID: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['payload'],
      additionalProperties: false,
    },
    result: { type: 'string' },
  },
} as const satisfies ProtocolDefinition

export type Protocol = typeof protocol
