import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'

import { CODECS, getDID } from './did.js'
import type { SignedHeader } from './schemas.js'
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

/**
 * Create a signing identity from an Ed25519 private key.
 */
export function createSigningIdentity(privateKey: Uint8Array): SigningIdentity {
  const publicKey = ed25519.getPublicKey(privateKey)
  const id = getDID(CODECS.EdDSA, publicKey)

  async function signToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    if (payload.iss != null && payload.iss !== id) {
      throw new Error(`Invalid payload with issuer ${payload.iss} used with signer ${id}`)
    }

    const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
    const fullPayload = { ...payload, iss: id }
    const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

    return {
      header: fullHeader,
      payload: fullPayload,
      signature: toB64U(ed25519.sign(fromUTF(data), privateKey)),
      data,
    }
  }

  return { id, signToken }
}

/**
 * Create a decrypting identity from an Ed25519 private key.
 * Uses X25519 key derivation for ECDH key agreement.
 */
export function createDecryptingIdentity(privateKey: Uint8Array): DecryptingIdentity {
  const publicKey = ed25519.getPublicKey(privateKey)
  const id = getDID(CODECS.EdDSA, publicKey)
  const x25519Private = ed25519.utils.toMontgomerySecret(privateKey)

  async function decrypt(_jwe: string): Promise<Uint8Array> {
    throw new Error('Not implemented')
  }

  async function agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array> {
    const { x25519 } = await import('@noble/curves/ed25519.js')
    return x25519.getSharedSecret(x25519Private, ephemeralPublicKey)
  }

  return { id, decrypt, agreeKey }
}

/**
 * Create a full identity (signing + decrypting) from an Ed25519 private key.
 */
export function createFullIdentity(privateKey: Uint8Array): FullIdentity {
  const signing = createSigningIdentity(privateKey)
  const decrypting = createDecryptingIdentity(privateKey)
  return { ...signing, ...decrypting }
}

/**
 * Generate a random identity with a new Ed25519 private key.
 */
export function randomIdentity(): OwnIdentity {
  const privateKey = ed25519.utils.randomSecretKey()
  return { ...createFullIdentity(privateKey), privateKey }
}
