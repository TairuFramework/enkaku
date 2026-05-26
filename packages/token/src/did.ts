import { base58 } from '@scure/base'
import type { DIDResolver } from './cache.js'
import { decodeMultibase } from './multibase.js'
import type { DIDDoc, VerificationMethod } from './peer4.js'
import { getPeer4ShortForm, isPeer4 } from './peer4.js'
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

/**
 * Resolve a token issuer (did:key or did:peer:4) to [alg, publicKey].
 * For did:peer:4 issuers, the resolver MUST be provided.
 */
export async function resolveIssuer(
  iss: string,
  header: ResolveIssuerHeader = {},
  resolver?: DIDResolver,
): Promise<[SignatureAlgorithm, Uint8Array]> {
  if (isPeer4(iss)) {
    if (resolver == null) {
      throw new Error('resolveIssuer: did:peer:4 requires a resolver')
    }
    const shortForm = getPeer4ShortForm(iss)
    const doc = await resolver(shortForm)
    if (doc == null) {
      throw new Error(`Unknown DID: ${shortForm}`)
    }
    if (header.kid == null) {
      const auth = doc.authentication
      if (auth == null || auth.length === 0) {
        throw new Error(
          'resolveIssuer: did:peer:4 token missing kid and doc has no authentication entries',
        )
      }
      return resolveKidFromDoc(doc, auth[0])
    }
    return resolveKidFromDoc(doc, header.kid)
  }

  return getSignatureInfo(iss)
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
