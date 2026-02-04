import type { SignedHeader, SignedPayload, UnsignedHeader } from './schemas.js'

export type SignedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
> = {
  data: string
  header: SignedHeader & Header
  payload: SignedPayload & Payload
  signature: string
}

export type UnsignedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
> = {
  data?: string
  header: UnsignedHeader & Header
  payload: Payload
  signature?: undefined
}

export type VerifiedToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
> = SignedToken<Payload, Header> & {
  verifiedPublicKey: Uint8Array
}

export type Token<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Header extends Record<string, unknown> = Record<string, unknown>,
> = UnsignedToken<Payload, Header> | SignedToken<Payload, Header> | VerifiedToken<Payload, Header>
