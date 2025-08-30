import { b64uFromJSON, fromB64, fromUTF, toB64, toB64U } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'

import { CODECS, getDID } from './did.js'
import type { SignedHeader } from './schemas.js'
import type { GenericSigner, OwnSigner, OwnTokenSigner, SignedToken, TokenSigner } from './types.js'

export { fromB64 as decodePrivateKey, toB64 as encodePrivateKey }

/**
 * Generate a random private key.
 */
export const randomPrivateKey = ed25519.utils.randomSecretKey

/**
 * Create a generic signer object for the given private key.
 */
export function getSigner(privateKey: Uint8Array | string, publicKey?: Uint8Array): GenericSigner {
  const key = typeof privateKey === 'string' ? fromB64(privateKey) : privateKey
  return {
    algorithm: 'EdDSA',
    publicKey: publicKey ?? ed25519.getPublicKey(key),
    sign: (bytes: Uint8Array) => ed25519.sign(bytes, key),
  }
}

/**
 * Generate a generic signer object with a random private key.
 */
export function randomSigner(): OwnSigner {
  const { publicKey, secretKey } = ed25519.keygen()
  return { ...getSigner(secretKey, publicKey), privateKey: secretKey }
}

/**
 * Create a token signer from a generic signer.
 */
export function toTokenSigner(signer: GenericSigner): TokenSigner {
  const codec = CODECS[signer.algorithm]
  if (codec == null) {
    throw new Error(`Unsupported signature algorithm: ${signer.algorithm}`)
  }

  const id = getDID(codec, signer.publicKey)

  async function createToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    if (payload.iss != null && payload.iss !== id) {
      throw new Error(`Invalid payload with issuer ${payload.iss} used with signer ${id}`)
    }

    const fullHeader = { ...header, typ: 'JWT', alg: signer.algorithm } as SignedHeader & Header
    const fullPayload = { ...payload, iss: id }
    const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

    return {
      header: fullHeader,
      payload: fullPayload,
      signature: toB64U(await signer.sign(fromUTF(data))),
      data,
    }
  }

  return { createToken, id }
}

/**
 * Create a token signer object for the given private key.
 */
export function getTokenSigner(privateKey: Uint8Array | string): TokenSigner {
  return toTokenSigner(getSigner(privateKey))
}

/**
 * Generate a token signer object with a random private key.
 */
export function randomTokenSigner(): OwnTokenSigner {
  const { privateKey, ...signer } = randomSigner()
  return { privateKey, ...toTokenSigner(signer) }
}
