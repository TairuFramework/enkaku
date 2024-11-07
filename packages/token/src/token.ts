import { b64uToJSON, fromB64U, fromUTF } from '@enkaku/codec'
import { assertType, isType } from '@enkaku/schema'

import { getSignatureInfo } from './did.js'
import {
  type SignedPayload,
  validateAlgorithm,
  validateSignedHeader,
  validateSignedPayload,
  validateUnsignedHeader,
} from './schemas.js'
import type { SignedToken, Token, TokenSigner, UnsignedToken, VerifiedToken } from './types.js'
import { type Verifiers, getVerifier } from './verifier.js'

export async function verifySignedPayload<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(
  signature: Uint8Array,
  payload: Payload,
  data: Uint8Array | string,
  verifiers?: Verifiers,
): Promise<Uint8Array> {
  assertType(validateSignedPayload, payload)
  const [alg, publicKey] = getSignatureInfo(payload.iss)
  const verify = getVerifier(alg, verifiers)
  const message = typeof data === 'string' ? fromUTF(data) : data
  const verified = await verify(signature, message, publicKey)
  if (!verified) {
    throw new Error('Invalid signature')
  }
  return publicKey
}

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

export function isUnsignedToken<Payload extends Record<string, unknown>>(
  token: Token<Payload>,
): token is UnsignedToken<Payload> {
  return isType(validateUnsignedHeader, token.header)
}

export function isVerifiedToken<Payload extends SignedPayload>(
  token: unknown,
): token is VerifiedToken<Payload> {
  return isSignedToken(token) && (token as VerifiedToken<Payload>).verifiedPublicKey != null
}

export function createUnsignedToken<
  Payload extends Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, header?: Header): UnsignedToken<Payload, Header> {
  return { header: { ...(header ?? ({} as Header)), typ: 'JWT', alg: 'none' }, payload }
}

export async function signToken<
  Payload extends Record<string, unknown>,
  Header extends Record<string, unknown>,
>(signer: TokenSigner, token: Token<Payload, Header>): Promise<SignedToken<Payload, Header>> {
  return isSignedToken(token)
    ? (token as SignedToken<Payload, Header>)
    : await signer.createToken(token.payload, token.header)
}

export async function verifyToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(token: Token<Payload> | string, verifiers?: Verifiers): Promise<Token<Payload>> {
  if (typeof token !== 'string') {
    if (isUnsignedToken(token) || isVerifiedToken(token)) {
      return token
    }
    if (isSignedToken(token)) {
      const verifiedPublicKey = await verifySignedPayload(
        fromB64U(token.signature),
        token.payload,
        token.data,
        verifiers,
      )
      return { ...token, verifiedPublicKey } as Token<Payload>
    }
    throw new Error('Unsupported token')
  }

  const [encodedHeader, encodedPayload, signature] = token.split('.')

  const header = b64uToJSON(encodedHeader)
  if (header.typ !== 'JWT') {
    throw new Error(`Invalid token header type: ${header.typ}`)
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
    const verifiedPublicKey = await verifySignedPayload(
      fromB64U(signature),
      payload,
      data,
      verifiers,
    )
    return {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as Token<Payload>
  }

  throw new Error(`Unsupported signature algorithm: ${header.alg}`)
}
