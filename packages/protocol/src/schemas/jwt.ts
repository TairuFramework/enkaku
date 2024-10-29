import type { Schema } from '@enkaku/schema'

export const signedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: { type: 'string', enum: ['EdDSA'] },
  },
  additionalProperties: true,
} as const satisfies Schema

export const unsignedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: { type: 'string', const: 'none' },
  },
  additionalProperties: true,
} as const satisfies Schema

export const headerSchema = {
  anyOf: [signedHeaderSchema, unsignedHeaderSchema],
} as const satisfies Schema

export const capabilitySchema = {
  anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
} as const satisfies Schema

export const signedPayloadSchema = {
  type: 'object',
  properties: {
    iss: { type: 'string' },
    sub: { type: 'string' },
    aud: { type: 'string' },
    cap: capabilitySchema,
    exp: { type: 'number' },
    nbf: { type: 'number' },
    iat: { type: 'number' },
  },
  required: ['iss'],
} as const satisfies Schema

export function createSignedMessageSchema(payloadSchema: Schema): Schema {
  return {
    type: 'object',
    properties: {
      header: signedHeaderSchema,
      payload: { allOf: [signedPayloadSchema, payloadSchema] },
    },
    required: ['header', 'payload'],
    additionalProperties: false,
  } as const satisfies Schema
}

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

export function createMessageSchema(payloadSchema: Schema): Schema {
  return {
    anyOf: [createSignedMessageSchema(payloadSchema), createUnsignedMessageSchema(payloadSchema)],
  } as const
}
