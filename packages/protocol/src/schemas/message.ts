import type { Schema } from '@enkaku/schema'
import { signedHeaderSchema, signedPayloadSchema, unsignedHeaderSchema } from '@enkaku/token'

/** @internal */
export function createSignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: signedHeaderSchema,
      payload: { allOf: [signedPayloadSchema, payloadSchema] },
      signature: { type: 'string' },
    },
    required: ['header', 'payload', 'signature'],
    additionalProperties: true,
  } as const satisfies Schema
}

/** @internal */
export function createUnsignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: unsignedHeaderSchema,
      payload: payloadSchema,
    },
    required: ['header', 'payload'],
    additionalProperties: true,
  } as const
}

/** @internal */
export function createMessageSchema(payloadSchema: Schema): Schema {
  return {
    anyOf: [createSignedMessageSchema(payloadSchema), createUnsignedMessageSchema(payloadSchema)],
  } as const
}
