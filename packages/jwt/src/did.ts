import { base58btc } from 'multiformats/bases/base58'

export function getDID(publicKey: Uint8Array): string {
  return `did:key:${base58btc.encode(publicKey)}`
}

export function getPublicKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:z')) {
    throw new Error(`Invalid DID to decode: ${did}`)
  }
  return base58btc.decode(did.slice(8))
}
