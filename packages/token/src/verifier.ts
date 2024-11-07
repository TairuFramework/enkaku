import { verifyAsync } from '@noble/ed25519'

import type { SignatureAlgorithm } from './schemas.js'

export type Verifier = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
) => Promise<boolean>

export type Verifiers = Partial<Record<SignatureAlgorithm, Verifier>>

export const defaultVerifiers: Verifiers = {
  EdDSA: verifyAsync,
}

export function getVerifier(algorithm: SignatureAlgorithm, verifiers: Verifiers = {}): Verifier {
  const verifier = verifiers[algorithm] ?? defaultVerifiers[algorithm]
  if (verifier == null) {
    throw new Error(`No verifier for algorithm: ${algorithm}`)
  }
  return verifier
}
