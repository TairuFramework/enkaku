import { canonicalStringify, fromUTF, toUTF } from '@enkaku/codec'
import { createValidator, type FromSchema, isType, type Schema } from '@enkaku/schema'

import { decodeMultibase, encodeMultibase, multihashSHA256, verifyMultihash } from './multibase.js'
import { concatBytes } from './utils.js'

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

const DEFAULT_MAX_DOC_SIZE = 64 * 1024

export type DecodePeer4Options = {
  /** Maximum allowed size of the canonical doc bytes. Default 64 KB. */
  maxDocSize?: number
}

/**
 * Check whether a value is a did:peer:4 identifier (either form).
 */
export function isPeer4(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${PEER4_PREFIX}z`)
}

/**
 * Extract the short form from either a short or long did:peer:4 string.
 */
export function getPeer4ShortForm(did: string): string {
  if (!isPeer4(did)) {
    throw new Error('Invalid did:peer:4 identifier')
  }
  const sep = did.indexOf(':', PEER4_PREFIX.length)
  return sep === -1 ? did : did.slice(0, sep)
}

function startsWithJsonCodec(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === JSON_MULTICODEC[0] && bytes[1] === JSON_MULTICODEC[1]
}

/**
 * Decode a did:peer:4 long form into its DID document.
 * Verifies the embedded hash against the encoded doc; throws on mismatch.
 */
export function decodePeer4(
  longForm: string,
  options: DecodePeer4Options = {},
): { longForm: string; shortForm: string; doc: DIDDoc } {
  if (!isPeer4(longForm)) {
    throw new Error('Invalid did:peer:4 identifier')
  }
  const sep = longForm.indexOf(':', PEER4_PREFIX.length)
  if (sep === -1) {
    throw new Error('Expected did:peer:4 long form, got short form')
  }
  const hashEncoded = longForm.slice(PEER4_PREFIX.length, sep)
  const encodedDoc = longForm.slice(sep + 1)

  const maxSize = options.maxDocSize ?? DEFAULT_MAX_DOC_SIZE
  if (encodedDoc.length > maxSize * 2) {
    throw new Error(`did:peer:4 encoded doc too large: ${encodedDoc.length} > ${maxSize * 2}`)
  }

  const hashBytes = decodeMultibase(hashEncoded)
  if (!verifyMultihash(hashBytes, fromUTF(encodedDoc))) {
    throw new Error('did:peer:4 hash mismatch')
  }

  const taggedDoc = decodeMultibase(encodedDoc)
  if (!startsWithJsonCodec(taggedDoc)) {
    throw new Error('did:peer:4 doc missing JSON multicodec prefix')
  }
  const docBytes = taggedDoc.slice(JSON_MULTICODEC.length)
  if (docBytes.length > maxSize) {
    throw new Error(`did:peer:4 doc too large: ${docBytes.length} > ${maxSize}`)
  }

  const doc = JSON.parse(toUTF(docBytes)) as unknown
  if (!validateDIDDoc(doc)) {
    throw new Error('did:peer:4 doc failed schema validation')
  }

  const shortForm = `${PEER4_PREFIX}${hashEncoded}`
  return { longForm, shortForm, doc }
}

/**
 * Encode a DID document as a did:peer:4 identifier.
 * Returns both the long form (self-contained, doc embedded) and short form (hash only).
 */
export function encodePeer4(doc: DIDDoc): { longForm: string; shortForm: string; doc: DIDDoc } {
  if (!validateDIDDoc(doc)) {
    throw new Error('did:peer:4 doc failed schema validation')
  }
  const canonicalDocBytes = fromUTF(canonicalStringify(doc))
  const taggedDoc = concatBytes(JSON_MULTICODEC, canonicalDocBytes)
  const encodedDoc = encodeMultibase(taggedDoc)
  const hashBytes = multihashSHA256(fromUTF(encodedDoc))
  const hash = encodeMultibase(hashBytes)
  const shortForm = `${PEER4_PREFIX}${hash}`
  const longForm = `${shortForm}:${encodedDoc}`
  return { longForm, shortForm, doc }
}
