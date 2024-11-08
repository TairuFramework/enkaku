import { verifyAsync } from '@noble/ed25519'

import type { SignatureAlgorithm } from './schemas.js'

export type Verifier = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
) => Promise<boolean>

export type Verifiers = Partial<Record<SignatureAlgorithm, Verifier>>

const verifyES256: Verifier = async (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> => {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    publicKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  return await globalThis.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    message,
  )
}

export const defaultVerifiers: Verifiers = {
  ES256: verifyES256,
  EdDSA: verifyAsync,
}

export function getVerifier(algorithm: SignatureAlgorithm, verifiers: Verifiers = {}): Verifier {
  const verifier = verifiers[algorithm] ?? defaultVerifiers[algorithm]
  if (verifier == null) {
    throw new Error(`No verifier for algorithm: ${algorithm}`)
  }
  return verifier
}
