import { base58btc } from 'multiformats/bases/base58'

import type { SignatureAlgorithm } from './schemas.js'

export const CODECS: Record<SignatureAlgorithm, Uint8Array> = {
  ES256: new Uint8Array([128, 36]),
  EdDSA: new Uint8Array([0xed, 0x01]),
}

function isCodecMatch(codec: Uint8Array, bytes: Uint8Array): boolean {
  for (let i = 0; i < codec.length; i++) {
    if (bytes[i] !== codec[i]) {
      return false
    }
  }
  return true
}

export function getAlgorithmAndPublicKey(
  bytes: Uint8Array,
): [SignatureAlgorithm, Uint8Array] | null {
  for (const [alg, codec] of Object.entries(CODECS)) {
    if (isCodecMatch(codec, bytes)) {
      return [alg as SignatureAlgorithm, bytes.slice(codec.length)]
    }
  }
  return null
}

export function getDID(codec: Uint8Array, publicKey: Uint8Array): string {
  const bytes = new Uint8Array(codec.length + publicKey.length)
  codec.forEach((v, i) => {
    bytes[i] = v
  })
  bytes.set(publicKey, codec.length)
  return `did:key:${base58btc.encode(bytes)}`
}

export function getSignatureInfo(did: string): [SignatureAlgorithm, Uint8Array] {
  if (!did.startsWith('did:key:z')) {
    throw new Error(`Invalid DID to decode: ${did}`)
  }

  const bytes = base58btc.decode(did.slice(8))
  const info = getAlgorithmAndPublicKey(bytes)
  if (info == null) {
    throw new Error(`Unsupported DID signature codec: ${did}`)
  }
  return info
}
