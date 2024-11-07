import { b64uFromJSON, fromB64, fromUTF, toB64, toB64U } from '@enkaku/codec'
import { getPublicKeyAsync, signAsync, utils } from '@noble/ed25519'

import { CODECS, getDID } from './did.js'
import type { SignedHeader } from './schemas.js'
import type { GenericSigner, OwnSigner, SignedToken, TokenSigner } from './types.js'

export { fromB64 as decodePrivateKey, toB64 as encodePrivateKey }

export const randomPrivateKey = utils.randomPrivateKey

export function getSigner(privateKey: Uint8Array | string): GenericSigner {
  const key = typeof privateKey === 'string' ? fromB64(privateKey) : privateKey
  return {
    algorithm: 'EdDSA',
    getPublicKey: () => getPublicKeyAsync(key),
    sign: (bytes: Uint8Array) => signAsync(bytes, key),
  }
}

export function randomSigner(): OwnSigner {
  const privateKey = randomPrivateKey()
  return { ...getSigner(privateKey), privateKey }
}

export function toTokenSigner(signer: GenericSigner): TokenSigner {
  const codec = CODECS[signer.algorithm]
  if (codec == null) {
    throw new Error(`Unsupported signature algorithm: ${signer.algorithm}`)
  }

  let issuerPromise: Promise<string> | undefined
  function getIssuer(): Promise<string> {
    if (issuerPromise == null) {
      issuerPromise = signer.getPublicKey().then((publiKey) => getDID(codec, publiKey))
    }
    return issuerPromise
  }

  async function createToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    const iss = await getIssuer()
    if (payload.iss != null && payload.iss !== iss) {
      throw new Error(`Invalid payload with issuer ${payload.iss} used with signer ${iss}`)
    }

    const fullHeader = { ...header, typ: 'JWT', alg: signer.algorithm } as SignedHeader & Header
    const fullPayload = { ...payload, iss }
    const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

    return {
      header: fullHeader,
      payload: fullPayload,
      signature: toB64U(await signer.sign(fromUTF(data))),
      data,
    }
  }

  return { createToken, getIssuer }
}

export function getTokenSigner(privateKey: Uint8Array | string): TokenSigner {
  return toTokenSigner(getSigner(privateKey))
}

export function randomTokenSigner(): TokenSigner {
  return toTokenSigner(randomSigner())
}
