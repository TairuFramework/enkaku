import { base58btc } from 'multiformats/bases/base58'

// ed25519-pub multicodec
const ED25519_BYTE = 0xed
const VARINT_BYTE = 0x01

export function getDID(publicKey: Uint8Array): string {
  const bytes = new Uint8Array(publicKey.length + 2)
  bytes[0] = ED25519_BYTE
  bytes[1] = VARINT_BYTE
  bytes.set(publicKey, 2)
  return `did:key:${base58btc.encode(bytes)}`
}

export function getPublicKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:z')) {
    throw new Error(`Invalid DID to decode: ${did}`)
  }
  const bytes = base58btc.decode(did.slice(8))
  if (bytes[0] !== ED25519_BYTE || bytes[1] !== VARINT_BYTE) {
    throw new Error('Unsupported DID: not an Ed25519 public key')
  }
  return bytes.slice(2)
}
