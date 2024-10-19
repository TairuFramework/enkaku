import { fromB64, toB64 } from '@enkaku/codec'
import { getPublicKeyAsync, signAsync, utils, verifyAsync } from '@noble/ed25519'

import { getPublicKey as didPublicKey, getDID } from './did.js'

export { fromB64 as decodePrivateKey, toB64 as encodePrivateKey }

export const randomPrivateKey = utils.randomPrivateKey

export type Principal = {
  did: string
}

export type Signer = Principal & {
  sign: (bytes: Uint8Array) => Promise<Uint8Array>
}

export async function getSigner(privateKey: Uint8Array | string): Promise<Signer> {
  const key = typeof privateKey === 'string' ? fromB64(privateKey) : privateKey
  return {
    did: getDID(await getPublicKeyAsync(key)),
    sign: (bytes: Uint8Array) => signAsync(bytes, key),
  }
}

export type OwnSigner = Signer & { privateKey: Uint8Array }

export async function randomSigner(): Promise<OwnSigner> {
  const privateKey = randomPrivateKey()
  const signer = await getSigner(privateKey)
  return { ...signer, privateKey }
}

export async function verifySignature(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  return await verifyAsync(signature, message, publicKey)
}

export type Verifier = Principal & {
  verify: (signature: Uint8Array, message: Uint8Array) => Promise<boolean>
}

export function getVerifier(didOrPublicKey: string | Uint8Array): Verifier {
  const [did, publicKey] =
    typeof didOrPublicKey === 'string'
      ? [didOrPublicKey, didPublicKey(didOrPublicKey)]
      : [getDID(didOrPublicKey), didOrPublicKey]
  return {
    did,
    verify: async (signature: Uint8Array, message: Uint8Array) => {
      return await verifySignature(signature, message, publicKey)
    },
  }
}
