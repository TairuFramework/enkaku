import type { GenericSigner } from '@enkaku/token'

function ecPointCompress(x: Uint8Array, y: Uint8Array): Uint8Array {
  const out = new Uint8Array(x.length + 1)
  out[0] = 2 + (y[y.length - 1] & 1)
  out.set(x, 1)
  return out
}

export async function getPublicKey(keyPair: CryptoKeyPair): Promise<Uint8Array> {
  const rawKey = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey)
  return ecPointCompress(new Uint8Array(rawKey.slice(1, 33)), new Uint8Array(rawKey.slice(33, 65)))
}

export async function getSigner(keyPair: CryptoKeyPair): Promise<GenericSigner> {
  const publicKey = await getPublicKey(keyPair)

  return {
    algorithm: 'ES256',
    publicKey,
    async sign(data): Promise<Uint8Array> {
      const signature = await globalThis.crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        // @ts-expect-error - ArrayBufferLike type
        data,
      )
      return new Uint8Array(signature)
    },
  }
}

export async function randomKeyPair(): Promise<CryptoKeyPair> {
  return await globalThis.crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
}
