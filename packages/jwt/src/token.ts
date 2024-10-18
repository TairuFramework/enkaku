import { getPublicKey } from './did.js'
import {
  base64URLToBytes,
  bytesToBase64URL,
  parseJSON,
  stringToBytes,
  stringifyJSON,
} from './encoding.js'
import { type Signer, verifySignature } from './principal.js'

export const SUPPORTED_ALG = 'EdDSA' as const

export type SignedHeader<Params extends Record<string, unknown> = Record<string, unknown>> =
  Params & { typ: 'JWT'; alg: 'EdDSA' }

export function isSignedHeader(header: unknown): header is SignedHeader {
  const h = header as SupportedHeader
  return h.typ === 'JWT' && h.alg === SUPPORTED_ALG
}

export type UnsignedHeader<Params extends Record<string, unknown> = Record<string, unknown>> =
  Params & { typ: 'JWT'; alg: 'none' }

export function isUnsignedHeader(header: unknown): header is UnsignedHeader {
  const h = header as UnsignedHeader
  return h.typ === 'JWT' && h.alg === 'none'
}

export type SupportedHeader<Params extends Record<string, unknown> = Record<string, unknown>> =
  | SignedHeader<Params>
  | UnsignedHeader<Params>

export type SignedPayload<Payload extends Record<string, unknown> = Record<string, unknown>> =
  Payload & { iss: string; sub?: string; aud?: string; exp?: number }

export async function verifySignedPayload<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(signature: Uint8Array, payload: Payload, data: Uint8Array | string): Promise<Uint8Array> {
  if (payload.iss == null) {
    throw new Error('Missing issuer in signed token')
  }
  const publicKey = getPublicKey(payload.iss as string)
  const message = typeof data === 'string' ? stringToBytes(data) : data
  const verified = await verifySignature(signature, message, publicKey)
  if (!verified) {
    throw new Error('Invalid signature')
  }
  return publicKey
}

export type SignedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends SignedHeader = SignedHeader,
> = {
  data: string
  header: Header
  payload: SignedPayload<Payload>
  signature: string
}

export function isSignedToken<Payload extends Record<string, unknown> = Record<string, unknown>>(
  token: Token<Payload>,
): token is SignedToken<Payload> {
  return isSignedHeader(token.header) && token.signature != null
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
  return isUnsignedHeader(token.header)
}

export type VerifiedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends SignedHeader = SignedHeader,
> = SignedToken<Payload, Header> & {
  verifiedPublicKey: Uint8Array
}

export function isVerifiedToken<Payload extends Record<string, unknown>>(
  token: Token<Payload>,
): token is VerifiedToken<Payload> {
  return isSignedHeader(token.header) && (token as VerifiedToken<Payload>).verifiedPublicKey != null
}

export type Token<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends SupportedHeader = SupportedHeader,
> = Header extends UnsignedHeader
  ? UnsignedToken<Payload, Header>
  : Header extends SignedHeader
    ? SignedToken<Payload, Header> | VerifiedToken<Payload, Header>
    : never

export async function createSignedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  HeaderParams extends Record<string, unknown> = Record<string, unknown>,
>(
  signer: Signer,
  payload: Payload,
  header?: HeaderParams,
): Promise<SignedToken<Payload, SignedHeader<HeaderParams>>> {
  if (payload.iss != null && payload.iss !== signer.did) {
    throw new Error(
      `Invalid signer ${signer.did} provided to sign payload with issuer ${payload.iss}`,
    )
  }

  const fullHeader = {
    ...(header ?? {}),
    typ: 'JWT',
    alg: SUPPORTED_ALG,
  } as SignedHeader<HeaderParams>
  const encodedHeader = stringifyJSON(fullHeader)
  const fullPayload = { ...payload, iss: signer.did }
  const encodedPayload = stringifyJSON(fullPayload)

  const data = `${encodedHeader}.${encodedPayload}`
  const signature = await signer.sign(stringToBytes(data))

  return {
    header: fullHeader,
    payload: fullPayload,
    signature: bytesToBase64URL(signature),
    data,
  }
}

export function createUnsignedToken<
  Payload extends Record<string, unknown>,
  HeaderParams extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, header?: HeaderParams): UnsignedToken<Payload, UnsignedHeader<HeaderParams>> {
  return {
    header: { ...((header ?? {}) as HeaderParams), typ: 'JWT', alg: 'none' },
    payload,
  }
}

export async function signToken<Payload extends Record<string, unknown>>(
  signer: Signer,
  token: Token<Payload>,
): Promise<SignedToken<Payload>> {
  return isSignedToken(token) ? token : await createSignedToken(signer, token.payload, token.header)
}

export function stringifyToken(token: Token): string {
  const parts = [stringifyJSON(token.header), stringifyJSON(token.payload)]
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
        base64URLToBytes(token.signature),
        token.payload,
        token.data,
      )
      return { ...token, verifiedPublicKey } as VerifiedToken<Payload>
    }
    throw new Error('Unsupported token')
  }

  const [encodedHeader, encodedPayload, signature] = token.split('.')

  const header = parseJSON(encodedHeader)
  if (header.typ !== 'JWT') {
    throw new Error(`Invalid token header type: ${header.typ}`)
  }
  if (header.alg === 'none') {
    return { header, payload: parseJSON<Payload>(encodedPayload) } as UnsignedToken<Payload>
  }

  if (header.alg === SUPPORTED_ALG) {
    if (signature == null) {
      throw new Error('Missing signature for token with signed header')
    }

    const payload = parseJSON<Payload>(encodedPayload)
    const data = `${encodedHeader}.${encodedPayload}`
    const verifiedPublicKey = await verifySignedPayload(base64URLToBytes(signature), payload, data)
    return {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as VerifiedToken<Payload>
  }

  throw new Error(`Unsupported header algorithm: ${header.alg}`)
}
