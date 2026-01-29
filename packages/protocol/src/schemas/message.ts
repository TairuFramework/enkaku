import type { Schema } from '@enkaku/schema'
import { signedHeaderSchema, signedPayloadSchema, unsignedHeaderSchema } from '@enkaku/token'

/** @internal */
function mergeSignedPayload(payloadSchema: Schema): Schema {
  const payloadObj = payloadSchema as {
    type: string
    properties?: Record<string, Schema>
    required?: Array<string>
  }
  return {
    type: 'object',
    properties: {
      ...signedPayloadSchema.properties,
      ...(payloadObj.properties ?? {}),
    },
    required: [...signedPayloadSchema.required, ...(payloadObj.required ?? [])],
    additionalProperties: false,
  } as const satisfies Schema
}

/** @internal */
export function createSignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: signedHeaderSchema,
      payload: mergeSignedPayload(payloadSchema),
      signature: { type: 'string' },
      data: { type: 'string' },
    },
    required: ['header', 'payload', 'signature'],
    additionalProperties: false,
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
    additionalProperties: false,
  } as const
}

export type MessageType = 'signed' | 'unsigned' | 'any'

/** @internal */
export function createMessageSchema(payloadSchema: Schema, type: MessageType = 'any'): Schema {
  switch (type) {
    case 'signed':
      return createSignedMessageSchema(payloadSchema)
    case 'unsigned':
      return createUnsignedMessageSchema(payloadSchema)
    default:
      return {
        anyOf: [
          createSignedMessageSchema(payloadSchema),
          createUnsignedMessageSchema(payloadSchema),
        ],
      } as const
  }
}
