import type { FromSchema, Schema } from '@enkaku/schema'

export const errorObject = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    data: { type: 'object' },
  },
  required: ['code', 'message'],
  additionalProperties: false,
} as const satisfies Schema
export type ErrorObject = FromSchema<typeof errorObject>
