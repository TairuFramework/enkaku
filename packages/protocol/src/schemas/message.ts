import { signedHeaderSchema, signedPayloadSchema, unsignedHeaderSchema } from '@kokuin/token'
import type { Schema } from '@sozai/schema'

/**
 * Upper bound for the DID-valued claims (iss/sub/aud). A did:peer:4 long form
 * inlines its DID document, so it far exceeds a did:key length; 1024 admits a
 * typical two-key peer:4 long form (~518 chars) with headroom while still
 * bounding token size.
 */
const DID_MAX_LENGTH = 1024

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
      // A did:peer:4 long form inlines the whole DID document, so iss/sub/aud can
      // run ~518 chars for a two-key identity — well past the old 256 cap that
      // predated peer:4 support and silently rejected every long-form frame
      // (EK08) before the resolver ran. Widened to still bound abuse.
      iss: { type: 'string', maxLength: DID_MAX_LENGTH },
      sub: { type: 'string', maxLength: DID_MAX_LENGTH },
      aud: { type: 'string', maxLength: DID_MAX_LENGTH },
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
      signature: { type: 'string', maxLength: 512 },
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
