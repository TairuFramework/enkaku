import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { CODECS, getDID, type SignedHeader, type SigningIdentity, type SignedToken } from '@enkaku/token'

import { BrowserKeyStore } from './store.js'
import { getPublicKey } from './utils.js'

async function createBrowserSigningIdentity(keyPair: CryptoKeyPair): Promise<SigningIdentity> {
  const publicKey = await getPublicKey(keyPair)
  const id = getDID(CODECS.ES256, publicKey)

  async function signToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    if (payload.iss != null && payload.iss !== id) {
      throw new Error(`Invalid payload with issuer ${payload.iss} used with signer ${id}`)
    }

    const fullHeader = { ...header, typ: 'JWT', alg: 'ES256' } as SignedHeader & Header
    const fullPayload = { ...payload, iss: id }
    const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

    const messageBytes = fromUTF(data)
    const signatureBuffer = await globalThis.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      messageBytes.buffer as ArrayBuffer,
    )

    return {
      header: fullHeader,
      payload: fullPayload,
      signature: toB64U(new Uint8Array(signatureBuffer)),
      data,
    }
  }

  return { id, signToken }
}

export async function provideSigningIdentity(
  keyID: string,
  useStore?: BrowserKeyStore | Promise<BrowserKeyStore> | string,
): Promise<SigningIdentity> {
  const storePromise =
    useStore == null || typeof useStore === 'string'
      ? BrowserKeyStore.open(useStore)
      : Promise.resolve(useStore)
  const store = await storePromise
  const keyPair = await store.entry(keyID).provideAsync()
  return createBrowserSigningIdentity(keyPair)
}
