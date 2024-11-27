import { type FromSchema, type Schema, createValidator } from '@enkaku/schema'

/** @internal */
export const SUPPORTED_ALGORITHMS = ['EdDSA', 'ES256'] as const

/** @internal */
export const signatureAlgorithmSchema = {
  type: 'string',
  enum: SUPPORTED_ALGORITHMS,
} as const satisfies Schema
/** @internal */
export type SignatureAlgorithm = FromSchema<typeof signatureAlgorithmSchema>

/** @internal */
export const validateAlgorithm = createValidator(signatureAlgorithmSchema)

/** @internal */
export const signedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: signatureAlgorithmSchema,
  },
  required: ['typ', 'alg'],
  additionalProperties: true,
} as const satisfies Schema
/** @internal */
export type SignedHeader = FromSchema<typeof signedHeaderSchema>

/** @internal */
export const validateSignedHeader = createValidator(signedHeaderSchema)

/** @internal */
export const unsignedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: { type: 'string', const: 'none' },
  },
  required: ['typ', 'alg'],
  additionalProperties: true,
} as const satisfies Schema
/** @internal */
export type UnsignedHeader = FromSchema<typeof unsignedHeaderSchema>

/** @internal */
export const validateUnsignedHeader = createValidator(unsignedHeaderSchema)

/** @internal */
export const supportedHeaderSchema = {
  anyOf: [signedHeaderSchema, unsignedHeaderSchema],
} as const satisfies Schema
/** @internal */
export type SupportedHeader = FromSchema<typeof supportedHeaderSchema>

/** @internal */
export const capabilitySchema = {
  anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
} as const satisfies Schema

/** @internal */
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
/** @internal */
export type SignedPayload = FromSchema<typeof signedPayloadSchema>

/** @internal */
export const validateSignedPayload = createValidator(signedPayloadSchema)
