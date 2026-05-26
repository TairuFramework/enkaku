import { base58 } from '@scure/base'
import type { DIDResolver } from './cache.js'
import { decodeMultibase } from './multibase.js'
import type { DIDDoc, VerificationMethod } from './peer4.js'
import { decodePeer4, encodePeer4, getPeer4ShortForm, isPeer4 } from './peer4.js'
import type { SignatureAlgorithm } from './schemas.js'

/** @internal */
export const CODECS: Record<SignatureAlgorithm, Uint8Array> = {
  ES256: new Uint8Array([128, 36]),
  EdDSA: new Uint8Array([0xed, 0x01]),
}

const EXPECTED_KEY_SIZES: Record<string, number> = {
  EdDSA: 32,
  ES256: 33,
}

const PREFIX = 'did:key:z'

function isCodecMatch(codec: Uint8Array, bytes: Uint8Array): boolean {
  if (bytes.length < codec.length) return false
  for (let i = 0; i < codec.length; i++) {
    if (bytes[i] !== codec[i]) {
      return false
    }
  }
  return true
}

/** @internal */
export function getAlgorithmAndPublicKey(
  bytes: Uint8Array,
): [SignatureAlgorithm, Uint8Array] | null {
  for (const [alg, codec] of Object.entries(CODECS)) {
    if (isCodecMatch(codec, bytes)) {
      return [alg as SignatureAlgorithm, bytes.slice(codec.length)]
    }
  }
  return null
}

/** @internal */
export function getDID(codec: Uint8Array, publicKey: Uint8Array): string {
  const bytes = new Uint8Array(codec.length + publicKey.length)
  codec.forEach((v, i) => {
    bytes[i] = v
  })
  bytes.set(publicKey, codec.length)
  return PREFIX + base58.encode(bytes)
}

/** @internal */
export function getSignatureInfo(did: string): [SignatureAlgorithm, Uint8Array] {
  if (!did.startsWith(PREFIX)) {
    throw new Error('Invalid DID format')
  }

  const bytes = base58.decode(did.slice(PREFIX.length))
  const info = getAlgorithmAndPublicKey(bytes)
  if (info == null) {
    throw new Error('Unsupported DID signature codec')
  }

  const [alg, publicKey] = info
  const expectedSize = EXPECTED_KEY_SIZES[alg]
  if (expectedSize != null && publicKey.length !== expectedSize) {
    throw new Error('Invalid public key size')
  }
  return info
}

export type ResolveIssuerHeader = { kid?: string }

export type ResolveIssuerWithDocResult = {
  alg: SignatureAlgorithm
  publicKey: Uint8Array
  /** Present when iss was a peer:4 long form or resolver returned a doc — caller may use to populate a cache. */
  peer4Doc?: { shortForm: string; doc: DIDDoc }
}

/**
 * Resolve a token issuer (did:key or did:peer:4) and return alg + public key,
 * plus the decoded peer:4 doc when one was obtained inline or via the resolver.
 * Callers writing to a DID cache should write `peer4Doc` only after signature verification.
 */
export async function resolveIssuerWithDoc(
  iss: string,
  header: ResolveIssuerHeader = {},
  resolver?: DIDResolver,
): Promise<ResolveIssuerWithDocResult> {
  if (isPeer4(iss)) {
    const shortForm = getPeer4ShortForm(iss)

    if (iss !== shortForm) {
      const { doc } = decodePeer4(iss)
      const [alg, publicKey] = resolveKidOrAuth(doc, header.kid)
      return { alg, publicKey, peer4Doc: { shortForm, doc } }
    }

    if (resolver == null) {
      throw new Error(`Unknown DID: ${shortForm}`)
    }
    const doc = await resolver(shortForm)
    if (doc == null) {
      throw new Error(`Unknown DID: ${shortForm}`)
    }
    const expected = encodePeer4(doc).shortForm
    if (expected !== shortForm) {
      throw new Error('DIDResolver: short form/doc hash mismatch')
    }
    const [alg, publicKey] = resolveKidOrAuth(doc, header.kid)
    return { alg, publicKey, peer4Doc: { shortForm, doc } }
  }

  const [alg, publicKey] = getSignatureInfo(iss)
  return { alg, publicKey }
}

/**
 * Resolve a token issuer to [alg, publicKey]. Backward-compatible wrapper around resolveIssuerWithDoc.
 */
export async function resolveIssuer(
  iss: string,
  header: ResolveIssuerHeader = {},
  resolver?: DIDResolver,
): Promise<[SignatureAlgorithm, Uint8Array]> {
  const { alg, publicKey } = await resolveIssuerWithDoc(iss, header, resolver)
  return [alg, publicKey]
}

function resolveKidOrAuth(doc: DIDDoc, kid: string | undefined): [SignatureAlgorithm, Uint8Array] {
  if (kid == null) {
    const auth = doc.authentication
    if (auth == null || auth.length === 0) {
      throw new Error(
        'resolveIssuer: did:peer:4 token missing kid and doc has no authentication entries',
      )
    }
    return resolveKidFromDoc(doc, auth[0])
  }
  return resolveKidFromDoc(doc, kid)
}

function resolveKidFromDoc(doc: DIDDoc, kid: string): [SignatureAlgorithm, Uint8Array] {
  const method = (doc.verificationMethod as Array<VerificationMethod>).find((m) => m.id === kid)
  if (method == null) {
    throw new Error(`KidNotFound: ${kid}`)
  }
  const bytes = decodeMultibase(method.publicKeyMultibase)
  const info = getAlgorithmAndPublicKey(bytes)
  if (info == null) {
    throw new Error('Unsupported verification method codec')
  }
  return info
}

/**
 * Fold a DID to its canonical form for equality comparison.
 * For did:peer:4, returns the short form regardless of whether input is long or short.
 * All other DID methods pass through unchanged.
 */
export function normalizeDID(did: string): string {
  return isPeer4(did) ? getPeer4ShortForm(did) : did
}
