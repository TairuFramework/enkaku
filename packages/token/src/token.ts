import { b64uFromJSON, b64uToJSON, fromB64U, fromUTF, toB64U } from '@enkaku/codec'
import { type FromSchema, type Schema, assertType, createValidator, isType } from '@enkaku/schema'

import { getPublicKey } from './did.js'
import { type Signer, verifySignature } from './principal.js'

export const SUPPORTED_ALG = 'EdDSA' as const

export const signedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: { type: 'string', enum: ['EdDSA'] },
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

export async function verifySignedPayload<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(signature: Uint8Array, payload: Payload, data: Uint8Array | string): Promise<Uint8Array> {
  assertType(validateSignedPayload, payload)
  const publicKey = getPublicKey(payload.iss)
  const message = typeof data === 'string' ? fromUTF(data) : data
  const verified = await verifySignature(signature, message, publicKey)
  if (!verified) {
    throw new Error('Invalid signature')
  }
  return publicKey
}

export type SignedToken<
  Payload extends SignedPayload = SignedPayload,
  Header extends SignedHeader = SignedHeader,
> = {
  data: string
  header: Header
  payload: Payload
  signature: string
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

export type UnsignedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends UnsignedHeader = UnsignedHeader,
> = {
  data?: string
  header: Header
  payload: Payload
  signature?: undefined
}

export function isUnsignedToken<Payload extends Record<string, unknown>>(
  token: Token<Payload>,
): token is UnsignedToken<Payload> {
  return isType(validateUnsignedHeader, token.header)
}

export type VerifiedToken<
  Payload extends SignedPayload = SignedPayload,
  Header extends SignedHeader = SignedHeader,
> = SignedToken<Payload, Header> & {
  verifiedPublicKey: Uint8Array
}

export function isVerifiedToken<Payload extends SignedPayload>(
  token: unknown,
): token is VerifiedToken<Payload> {
  return isSignedToken(token) && (token as VerifiedToken<Payload>).verifiedPublicKey != null
}

export type Token<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends SupportedHeader = SupportedHeader,
> = Header extends SignedHeader
  ? Payload extends SignedPayload
    ? SignedToken<Payload, Header> | VerifiedToken<Payload, Header>
    : never
  : Header extends UnsignedHeader
    ? UnsignedToken<Payload, Header>
    : never

export async function createSignedToken<Payload extends SignedPayload = SignedPayload>(
  signer: Signer,
  payload: Partial<Payload>,
  header?: Record<string, unknown>,
): Promise<SignedToken<Payload, SignedHeader>> {
  if (payload.iss != null && payload.iss !== signer.did) {
    throw new Error(
      `Invalid signer ${signer.did} provided to sign payload with issuer ${payload.iss}`,
    )
  }

  const fullHeader = {
    ...(header ?? {}),
    typ: 'JWT',
    alg: SUPPORTED_ALG,
  } as SignedHeader
  const encodedHeader = b64uFromJSON(fullHeader)
  const fullPayload = { ...payload, iss: signer.did }
  const encodedPayload = b64uFromJSON(fullPayload)

  const data = `${encodedHeader}.${encodedPayload}`
  const signature = await signer.sign(fromUTF(data))

  return {
    header: fullHeader,
    payload: fullPayload as Payload,
    signature: toB64U(signature),
    data,
  }
}

export function createUnsignedToken<
  Payload extends Record<string, unknown>,
  Header extends UnsignedHeader = UnsignedHeader,
>(payload: Payload, header: Record<string, unknown> = {}): UnsignedToken<Payload, Header> {
  return { header: { ...header, typ: 'JWT', alg: 'none' } as Header, payload }
}

export async function signToken<Payload extends SignedPayload>(
  signer: Signer,
  token: Token<Payload>,
): Promise<SignedToken<Payload>> {
  return isSignedToken(token)
    ? (token as SignedToken<Payload>)
    : await createSignedToken<Payload>(signer, token.payload, token.header)
}

export function stringifyToken(token: Token): string {
  const parts = [b64uFromJSON(token.header), b64uFromJSON(token.payload)]
  if (token.signature != null) {
    parts.push(token.signature)
  }
  return parts.join('.')
}

export async function verifyToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(token: Token<Payload> | string): Promise<Token<Payload>> {
  if (typeof token !== 'string') {
    if (isUnsignedToken(token) || isVerifiedToken(token)) {
      return token
    }
    if (isSignedToken(token)) {
      const verifiedPublicKey = await verifySignedPayload(
        fromB64U(token.signature),
        token.payload,
        token.data,
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

  if (header.alg === SUPPORTED_ALG) {
    if (signature == null) {
      throw new Error('Missing signature for token with signed header')
    }

    const payload = b64uToJSON<Payload>(encodedPayload)
    const data = `${encodedHeader}.${encodedPayload}`
    const verifiedPublicKey = await verifySignedPayload(fromB64U(signature), payload, data)
    return {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as Token<Payload>
  }

  throw new Error(`Unsupported header algorithm: ${header.alg}`)
}
