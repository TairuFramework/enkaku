import type { SignedToken } from '@enkaku/jwt'

export type CapabilityPayload = {
  iss: string
  aud: string
  exp?: number
  iat?: number
  jti?: string
}

export type CapabilityToken = SignedToken<CapabilityPayload>
