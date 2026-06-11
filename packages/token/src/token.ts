import { b64uFromJSON, b64uToJSON, canonicalStringify, fromB64U, fromUTF } from '@enkaku/codec'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import { assertType, isType } from '@enkaku/schema'

import type { DIDCache, DIDResolver } from './cache.js'
import { resolveIssuerWithDoc } from './did.js'
import type { SigningIdentity } from './identity.js'
import {
  type SignedPayload,
  validateAlgorithm,
  validateSignedHeader,
  validateSignedPayload,
  validateUnsignedHeader,
} from './schemas.js'
import { assertTimeClaimsValid, type TimeValidationOptions } from './time.js'
import type { SignedToken, Token, UnsignedToken, VerifiedToken } from './types.js'
import { getVerifier, type Verifiers } from './verifier.js'

const tokenTracer = createTracer('token')

// Tokens whose signature was verified in this process. Deserialized JSON can carry a
// `verifiedPublicKey` property but can never be a member of this set, so verification
// is only ever skipped for objects produced by `verifyToken` itself.
const verifiedTokens = new WeakSet<object>()

export type VerifyTokenOptions = TimeValidationOptions & {
  verifiers?: Verifiers
  resolver?: DIDResolver
  cache?: DIDCache
}

export type VerifySignedPayloadInput<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> = {
  signature: Uint8Array
  payload: Payload
  header: { alg?: string; kid?: string }
  data: Uint8Array | string
  verifiers?: Verifiers
  resolver?: DIDResolver
  cache?: DIDCache
}

/**
 * Verify the signature of a signed payload and return the public key of the issuer.
 */
export async function verifySignedPayload<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(input: VerifySignedPayloadInput<Payload>): Promise<Uint8Array> {
  const { signature, payload, header, data, verifiers, resolver, cache } = input
  assertType(validateSignedPayload, payload)
  const effectiveResolver: DIDResolver | undefined =
    cache == null
      ? resolver
      : async (did) => {
          const cached = await cache.get(did)
          if (cached != null) return cached
          return resolver != null ? resolver(did) : undefined
        }
  const { alg, publicKey, peer4Doc } = await resolveIssuerWithDoc(
    payload.iss,
    { kid: header.kid },
    effectiveResolver,
  )
  const verify = getVerifier(alg, verifiers)
  const message = typeof data === 'string' ? fromUTF(data) : data
  const verified = await verify(signature, message, publicKey)
  if (!verified) {
    throw new Error('Invalid signature')
  }
  if (cache != null && peer4Doc != null) {
    await cache.set(peer4Doc.shortForm, peer4Doc.doc)
  }
  return publicKey
}

/**
 * Check if a token is signed.
 */
export function isSignedToken<Payload extends SignedPayload = SignedPayload>(
  token: unknown,
): token is SignedToken<Payload> {
  const t = token as SignedToken<Payload>
  return (
    isType(validateSignedHeader, t.header) &&
    isType(validateSignedPayload, t.payload) &&
    t.signature != null
  )
}

/**
 * Check if a token is unsigned.
 */
export function isUnsignedToken<Payload extends Record<string, unknown>>(
  token: Token<Payload>,
): token is UnsignedToken<Payload> {
  return isType(validateUnsignedHeader, token.header)
}

/**
 * Check if a token was verified by `verifyToken` in this process.
 * A `verifiedPublicKey` property on a deserialized token is never trusted.
 */
export function isVerifiedToken<Payload extends SignedPayload>(
  token: unknown,
): token is VerifiedToken<Payload> {
  return (
    isSignedToken(token) &&
    (token as VerifiedToken<Payload>).verifiedPublicKey != null &&
    verifiedTokens.has(token as object)
  )
}

/**
 * Create an unsigned token object.
 */
export function createUnsignedToken<
  Payload extends Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, header?: Header): UnsignedToken<Payload, Header> {
  return { header: { ...(header ?? ({} as Header)), typ: 'JWT', alg: 'none' }, payload }
}

/**
 * Sign a token object if not already signed.
 */
export async function signToken<
  Payload extends Record<string, unknown>,
  Header extends Record<string, unknown>,
>(signer: SigningIdentity, token: Token<Payload, Header>): Promise<SignedToken<Payload, Header>> {
  return isSignedToken(token)
    ? (token as SignedToken<Payload, Header>)
    : ((await signer.signToken(token.payload, { header: token.header })) as SignedToken<
        Payload,
        Header
      >)
}

function getVerifiableData(token: SignedToken<Record<string, unknown>>): string {
  const recomputed = `${b64uFromJSON(token.header)}.${b64uFromJSON(token.payload)}`
  const data = token.data
  if (data == null || data === recomputed) {
    return recomputed
  }
  // `data` may use a different JSON serialization of the same header and payload.
  // Accept it only if it decodes to exactly the same values, so the signed bytes
  // can never be decoupled from the payload used for authorization.
  const parts = data.split('.')
  if (parts.length === 2) {
    try {
      if (
        canonicalStringify(b64uToJSON(parts[0])) === canonicalStringify(token.header) &&
        canonicalStringify(b64uToJSON(parts[1])) === canonicalStringify(token.payload)
      ) {
        return data
      }
    } catch {
      // invalid base64url or JSON in data: fall through to the error below
    }
  }
  throw new Error('Invalid token: data does not match header and payload')
}

async function verifyTokenInner<Payload extends Record<string, unknown> = Record<string, unknown>>(
  token: Token<Payload> | string,
  options: VerifyTokenOptions = {},
): Promise<Token<Payload>> {
  const { verifiers, resolver, cache, ...timeOptions } = options
  if (typeof token !== 'string') {
    if (isUnsignedToken(token)) {
      return token
    }
    if (isVerifiedToken(token)) {
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      return token
    }
    if (isSignedToken(token)) {
      const data = getVerifiableData(token)
      const verifiedPublicKey = await verifySignedPayload({
        signature: fromB64U(token.signature),
        payload: token.payload,
        header: token.header as { alg?: string; kid?: string },
        data,
        verifiers,
        resolver,
        cache,
      })
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      const result = { ...token, data, verifiedPublicKey } as Token<Payload>
      verifiedTokens.add(result)
      return result
    }
    throw new Error('Unsupported token')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format: expected 3 parts separated by dots')
  }
  const [encodedHeader, encodedPayload, signature] = parts

  const header = b64uToJSON(encodedHeader)
  if (header.typ !== 'JWT') {
    throw new Error('Invalid token header type')
  }
  if (header.alg === 'none') {
    return { header, payload: b64uToJSON<Payload>(encodedPayload) } as UnsignedToken<Payload>
  }

  if (isType(validateAlgorithm, header.alg)) {
    if (signature == null) {
      throw new Error('Missing signature for token with signed header')
    }

    const payload = b64uToJSON<Payload>(encodedPayload)
    const data = `${encodedHeader}.${encodedPayload}`
    const verifiedPublicKey = await verifySignedPayload({
      signature: fromB64U(signature),
      payload,
      header: header as { alg?: string; kid?: string },
      data,
      verifiers,
      resolver,
      cache,
    })
    assertTimeClaimsValid(payload as Record<string, unknown>, timeOptions)
    const result = {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as Token<Payload>
    verifiedTokens.add(result)
    return result
  }

  throw new Error('Unsupported signature algorithm')
}

/**
 * Verify a token is either unsigned or signed with a valid signature.
 * Also validates time-based claims (exp, nbf) if present.
 */
export async function verifyToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(token: Token<Payload> | string, options: VerifyTokenOptions = {}): Promise<Token<Payload>> {
  return withSpan(tokenTracer, SpanNames.TOKEN_VERIFY, {}, async (span) => {
    const result = await verifyTokenInner(token, options)
    if (isSignedToken(result)) {
      span.setAttribute(
        AttributeKeys.AUTH_DID,
        (result.payload as Record<string, unknown>).iss as string,
      )
      span.setAttribute(AttributeKeys.AUTH_ALGORITHM, result.header.alg)
    }
    return result
  })
}
