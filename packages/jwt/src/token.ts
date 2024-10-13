import { bytesToBase64URL, decodeJSON, encodeJSON, stringToBytes } from './encoding.js'
import type { Signer } from './principal.js'

export type SignedHeader = {
  typ: 'JWT'
  alg: 'EdDSA'
  [key: string]: unknown
}

export type UnsignedHeader = {
  typ: 'JWT'
  alg: 'none'
  [key: string]: unknown
}

export type SupportedHeader = SignedHeader | UnsignedHeader

export type SignedPayload<Payload extends Record<string, unknown> = Record<string, unknown>> =
  Payload & { iss: string }

export type SignedToken<
  Payload extends Record<string, unknown>,
  Header extends SignedHeader = SignedHeader,
> = {
  header: Header
  payload: Payload
  signature: string
}

export type UnsignedToken<
  Payload extends Record<string, unknown>,
  Header extends UnsignedHeader = UnsignedHeader,
> = {
  header: Header
  payload: Payload
  signature?: undefined
}

export type Token<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends SupportedHeader = SupportedHeader,
> = Header extends UnsignedHeader
  ? UnsignedToken<Payload, Header>
  : Header extends SignedHeader
    ? SignedToken<Payload, Header>
    : never

export async function signToken<Payload extends Record<string, unknown> = Record<string, unknown>>(
  signer: Signer,
  payload: Payload,
  header: Record<string, unknown> = {},
): Promise<SignedToken<Payload & { iss: string }>> {
  if (payload.iss != null && payload.iss !== signer.did) {
    throw new Error(
      `Invalid signer ${signer.did} provided to sign payload with issuer ${payload.iss}`,
    )
  }

  const issuerPayload = { ...payload, iss: signer.did }
  const signature = await signer.sign(stringToBytes(JSON.stringify(issuerPayload)))

  return {
    header: { ...header, typ: 'JWT', alg: 'EdDSA' },
    payload: issuerPayload,
    signature: bytesToBase64URL(signature),
  }
}

export function unsignedToken<Payload extends Record<string, unknown>>(
  payload: Payload,
  header: Record<string, unknown> = {},
): UnsignedToken<Payload> {
  return { header: { ...header, typ: 'JWT', alg: 'none' }, payload }
}

export function tokenToString(token: Token): string {
  const parts = [encodeJSON(token.header), encodeJSON(token.payload)]
  if (token.signature != null) {
    parts.push(token.signature)
  }
  return parts.join('.')
}

export function parseToken<Payload extends Record<string, unknown> = Record<string, unknown>>(
  value: string,
): Token<Payload> {
  const [encodedHeader, payload, signature] = value.split('.')
  const header = decodeJSON(encodedHeader)
  if (header.typ !== 'JWT') {
    throw new Error(`Invalid token header type: ${header.typ}`)
  }
  if (header.alg === 'EdDSA') {
    return { header, payload: decodeJSON(payload), signature } as SignedToken<Payload>
  }
  if (header.alg === 'none') {
    return { header, payload: decodeJSON(payload) } as UnsignedToken<Payload>
  }
  throw new Error(`Unsupported header algorithm: ${header.alg}`)
}
