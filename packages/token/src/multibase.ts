import { sha256 } from '@noble/hashes/sha2.js'
import { base58 } from '@scure/base'

const MULTIBASE_BASE58BTC = 'z'
const MULTIHASH_SHA256_CODE = 0x12
const MULTIHASH_SHA256_LENGTH = 0x20

export function encodeMultibase(bytes: Uint8Array): string {
  return MULTIBASE_BASE58BTC + base58.encode(bytes)
}

export function decodeMultibase(value: string): Uint8Array {
  if (value.length === 0) {
    throw new Error('Invalid multibase encoding: empty string')
  }
  const prefix = value[0]
  if (prefix !== MULTIBASE_BASE58BTC) {
    throw new Error(`Unsupported multibase prefix: ${prefix}`)
  }
  return base58.decode(value.slice(1))
}

export function multihashSHA256(bytes: Uint8Array): Uint8Array {
  const digest = sha256(bytes)
  const out = new Uint8Array(2 + digest.length)
  out[0] = MULTIHASH_SHA256_CODE
  out[1] = MULTIHASH_SHA256_LENGTH
  out.set(digest, 2)
  return out
}

export function verifyMultihash(multihash: Uint8Array, bytes: Uint8Array): boolean {
  if (multihash.length !== 2 + MULTIHASH_SHA256_LENGTH) return false
  if (multihash[0] !== MULTIHASH_SHA256_CODE) return false
  if (multihash[1] !== MULTIHASH_SHA256_LENGTH) return false
  const expected = sha256(bytes)
  for (let i = 0; i < MULTIHASH_SHA256_LENGTH; i++) {
    if (multihash[2 + i] !== expected[i]) return false
  }
  return true
}
