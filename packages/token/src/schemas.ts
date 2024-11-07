import { type FromSchema, type Schema, createValidator } from '@enkaku/schema'

export const SUPPORTED_ALGORITHMS = ['EdDSA', 'ES256'] as const

export const signatureAlgorithmSchema = {
  type: 'string',
  enum: SUPPORTED_ALGORITHMS,
} as const satisfies Schema
export type SignatureAlgorithm = FromSchema<typeof signatureAlgorithmSchema>

export const validateAlgorithm = createValidator(signatureAlgorithmSchema)

export const signedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: signatureAlgorithmSchema,
  },
  required: ['typ', 'alg'],
  additionalProperties: true,
} as const satisfies Schema
export type SignedHeader = FromSchema<typeof signedHeaderSchema>

export const validateSignedHeader = createValidator(signedHeaderSchema)

export const unsignedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: { type: 'string', const: 'none' },
  },
  required: ['typ', 'alg'],
  additionalProperties: true,
} as const satisfies Schema
export type UnsignedHeader = FromSchema<typeof unsignedHeaderSchema>

export const validateUnsignedHeader = createValidator(unsignedHeaderSchema)

export const supportedHeaderSchema = {
  anyOf: [signedHeaderSchema, unsignedHeaderSchema],
} as const satisfies Schema
export type SupportedHeader = FromSchema<typeof supportedHeaderSchema>

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
  additionalProperties: true,
} as const satisfies Schema
export type SignedPayload = FromSchema<typeof signedPayloadSchema>

export const validateSignedPayload = createValidator(signedPayloadSchema)
