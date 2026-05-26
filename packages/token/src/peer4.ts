import { createValidator, type FromSchema, isType, type Schema } from '@enkaku/schema'

/** @internal */
export const verificationMethodSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    publicKeyMultibase: { type: 'string' },
  },
  required: ['id', 'type', 'publicKeyMultibase'],
  additionalProperties: true,
} as const satisfies Schema
/** @internal */
export type VerificationMethod = FromSchema<typeof verificationMethodSchema>

/** @internal */
export const didDocSchema = {
  type: 'object',
  properties: {
    '@context': {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    verificationMethod: {
      type: 'array',
      items: verificationMethodSchema,
      minItems: 1,
    },
    authentication: { type: 'array', items: { type: 'string' } },
    keyAgreement: { type: 'array', items: { type: 'string' } },
    assertionMethod: { type: 'array', items: { type: 'string' } },
  },
  required: ['verificationMethod'],
  additionalProperties: true,
} as const satisfies Schema
/** @internal */
export type DIDDoc = FromSchema<typeof didDocSchema>

const didDocValidator = createValidator(didDocSchema)

/**
 * Validate that an unknown value conforms to the DID document schema used inside did:peer:4.
 */
export function validateDIDDoc(value: unknown): value is DIDDoc {
  return isType(didDocValidator, value)
}
