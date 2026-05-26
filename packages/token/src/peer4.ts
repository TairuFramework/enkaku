import { canonicalStringify, fromUTF } from '@enkaku/codec'
import { createValidator, type FromSchema, isType, type Schema } from '@enkaku/schema'

import { encodeMultibase, multihashSHA256 } from './multibase.js'

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

const PEER4_PREFIX = 'did:peer:4'
const JSON_MULTICODEC = new Uint8Array([0x80, 0x04])

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/**
 * Encode a DID document as a did:peer:4 identifier.
 * Returns both the long form (self-contained, doc embedded) and short form (hash only).
 */
export function encodePeer4(doc: DIDDoc): { longForm: string; shortForm: string; doc: DIDDoc } {
  const canonicalDocBytes = fromUTF(canonicalStringify(doc))
  const taggedDoc = concatBytes(JSON_MULTICODEC, canonicalDocBytes)
  const encodedDoc = encodeMultibase(taggedDoc)
  const hashBytes = multihashSHA256(fromUTF(encodedDoc))
  const hash = encodeMultibase(hashBytes)
  const shortForm = `${PEER4_PREFIX}${hash}`
  const longForm = `${shortForm}:${encodedDoc}`
  return { longForm, shortForm, doc }
}
