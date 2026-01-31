import type { SignedToken } from './types.js'

export type Identity = { readonly id: string }

export type SigningIdentity = Identity & {
  signToken: <
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(
    payload: Payload,
    header?: Header,
  ) => Promise<SignedToken<Payload, Header>>
}

export type DecryptingIdentity = Identity & {
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array>
}

export type FullIdentity = SigningIdentity & DecryptingIdentity

export type OwnIdentity = FullIdentity & { privateKey: Uint8Array }

export function isSigningIdentity(identity: Identity): identity is SigningIdentity {
  return 'signToken' in identity && typeof (identity as SigningIdentity).signToken === 'function'
}

export function isDecryptingIdentity(identity: Identity): identity is DecryptingIdentity {
  return (
    'decrypt' in identity &&
    typeof (identity as DecryptingIdentity).decrypt === 'function' &&
    'agreeKey' in identity &&
    typeof (identity as DecryptingIdentity).agreeKey === 'function'
  )
}

export function isFullIdentity(identity: Identity): identity is FullIdentity {
  return isSigningIdentity(identity) && isDecryptingIdentity(identity)
}
