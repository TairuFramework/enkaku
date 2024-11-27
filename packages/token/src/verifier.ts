import { ed25519 } from '@noble/curves/ed25519'
import { p256 } from '@noble/curves/p256'
import { sha256 } from '@noble/hashes/sha256'

import type { SignatureAlgorithm } from './schemas.js'

/** @internal */
export type Verifier = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
) => boolean | Promise<boolean>

/** @internal */
export type Verifiers = Partial<Record<SignatureAlgorithm, Verifier>>

/** @internal */
export const defaultVerifiers: Verifiers = {
  ES256: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => {
    return p256.verify(signature, sha256(message), publicKey)
  },
  EdDSA: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => {
    return ed25519.verify(signature, message, publicKey)
  },
}

/** @internal */
export function getVerifier(algorithm: SignatureAlgorithm, verifiers: Verifiers = {}): Verifier {
  const verifier = verifiers[algorithm] ?? defaultVerifiers[algorithm]
  if (verifier == null) {
    throw new Error(`No verifier for algorithm: ${algorithm}`)
  }
  return verifier
}
