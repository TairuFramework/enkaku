import { b64uFromJSON, b64uToJSON, fromB64U, toB64U } from '@enkaku/codec'
import { gcm } from '@noble/ciphers/aes.js'
import { randomBytes } from '@noble/ciphers/utils.js'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'

import { getSignatureInfo } from './did.js'
import type { DecryptingIdentity } from './identity.js'

export type ConcatKDFParams = {
  sharedSecret: Uint8Array
  keyLength: number
  algorithmID: string
  partyUInfo: Uint8Array
  partyVInfo: Uint8Array
}

export type JWEHeader = {
  alg: string
  enc: string
  epk: { kty: string; crv: string; x: string }
  apu?: string
  apv?: string
}

export type TokenEncrypter = {
  recipientID?: string
  encrypt(plaintext: Uint8Array): Promise<string>
}

export type EncryptOptions = {
  algorithm: 'X25519'
}

function uint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  view.setUint32(0, value, false)
  return buf
}

function lengthPrefixed(data: Uint8Array): Uint8Array {
  const prefix = uint32BE(data.length)
  const result = new Uint8Array(4 + data.length)
  result.set(prefix)
  result.set(data, 4)
  return result
}

/**
 * Concat KDF per RFC 7518 Section 4.6.2.
 * Single SHA-256 iteration (sufficient for 256-bit keys).
 */
export function concatKDF(params: ConcatKDFParams): Uint8Array {
  const { sharedSecret, keyLength, algorithmID, partyUInfo, partyVInfo } = params
  const encoder = new TextEncoder()

  const algID = lengthPrefixed(encoder.encode(algorithmID))
  const apu = lengthPrefixed(partyUInfo)
  const apv = lengthPrefixed(partyVInfo)
  const keyDataLen = uint32BE(keyLength)

  // round = 1 (single iteration for 256-bit key)
  const round = uint32BE(1)

  // Hash(round || sharedSecret || algID || apu || apv || keyDataLen)
  const parts = [round, sharedSecret, algID, apu, apv, keyDataLen]
  let totalLength = 0
  for (const part of parts) {
    totalLength += part.length
  }
  const hashInput = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    hashInput.set(part, offset)
    offset += part.length
  }

  return sha256(hashInput).slice(0, keyLength / 8)
}

function encryptWithX25519(
  recipientPublicKey: Uint8Array,
  plaintext: Uint8Array,
): string {
  // Generate ephemeral X25519 key pair
  const ephemeralPrivateKey = x25519.utils.randomSecretKey()
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey)

  // Compute shared secret via ECDH
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey)

  // Derive content encryption key via Concat KDF
  const cek = concatKDF({
    sharedSecret,
    keyLength: 256,
    algorithmID: 'A256GCM',
    partyUInfo: new Uint8Array(0),
    partyVInfo: new Uint8Array(0),
  })

  // Generate random 96-bit IV for AES-GCM
  const iv = randomBytes(12)

  // Build protected header
  const protectedHeader: JWEHeader = {
    alg: 'ECDH-ES',
    enc: 'A256GCM',
    epk: {
      kty: 'OKP',
      crv: 'X25519',
      x: toB64U(ephemeralPublicKey),
    },
  }

  // Encode protected header
  const encodedHeader = b64uFromJSON(protectedHeader as unknown as Record<string, unknown>)

  // AAD is the ASCII bytes of the encoded header (per RFC 7516 Section 5.1 step 14)
  const aad = new TextEncoder().encode(encodedHeader)

  // Encrypt with AES-256-GCM (tag is appended to ciphertext)
  const cipher = gcm(cek, iv, aad)
  const ciphertextWithTag = cipher.encrypt(plaintext)

  // Split ciphertext and tag (GCM tag is last 16 bytes)
  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16)
  const tag = ciphertextWithTag.slice(ciphertextWithTag.length - 16)

  // JWE Compact Serialization: header.encryptedKey.iv.ciphertext.tag
  // For ECDH-ES direct, encrypted key is empty
  return [encodedHeader, '', toB64U(iv), toB64U(ciphertext), toB64U(tag)].join('.')
}

function resolveX25519Key(recipient: Uint8Array | string): { key: Uint8Array; id?: string } {
  if (typeof recipient !== 'string') {
    return { key: recipient }
  }

  const [algorithm, publicKey] = getSignatureInfo(recipient)
  if (algorithm === 'EdDSA') {
    return { key: ed25519.utils.toMontgomery(publicKey), id: recipient }
  }
  throw new Error(`Unsupported DID algorithm for encryption: ${algorithm}`)
}

/**
 * Create a token encrypter for a recipient identified by X25519 public key or DID string.
 */
export function createTokenEncrypter(
  recipient: Uint8Array,
  options: EncryptOptions,
): TokenEncrypter
export function createTokenEncrypter(recipient: string): TokenEncrypter
export function createTokenEncrypter(
  recipient: Uint8Array | string,
  options?: EncryptOptions,
): TokenEncrypter {
  if (typeof recipient !== 'string' && options?.algorithm !== 'X25519') {
    throw new Error(`Unsupported algorithm: ${options?.algorithm}`)
  }

  const { key, id } = resolveX25519Key(recipient)

  return {
    recipientID: id,
    async encrypt(plaintext: Uint8Array): Promise<string> {
      return encryptWithX25519(key, plaintext)
    },
  }
}

/**
 * Encrypt plaintext to JWE compact serialization using the given encrypter.
 */
export async function encryptToken(
  encrypter: TokenEncrypter,
  plaintext: Uint8Array,
): Promise<string> {
  return encrypter.encrypt(plaintext)
}

/**
 * Decrypt a JWE compact serialization string.
 */
export async function decryptToken(
  decrypter: DecryptingIdentity,
  jwe: string,
): Promise<Uint8Array> {
  const parts = jwe.split('.')
  if (parts.length !== 5) {
    throw new Error(`Invalid JWE format: expected 5 parts, got ${parts.length}`)
  }

  const [encodedHeader, _encryptedKey, encodedIV, encodedCiphertext, encodedTag] = parts

  // Parse protected header
  const header = b64uToJSON<JWEHeader>(encodedHeader)

  if (header.alg !== 'ECDH-ES') {
    throw new Error(`Unsupported JWE algorithm: ${header.alg}`)
  }
  if (header.enc !== 'A256GCM') {
    throw new Error(`Unsupported JWE encryption: ${header.enc}`)
  }

  // Extract ephemeral public key from header
  const ephemeralPublicKey = fromB64U(header.epk.x)

  // Compute shared secret via ECDH key agreement
  const sharedSecret = await decrypter.agreeKey(ephemeralPublicKey)

  // Derive content encryption key
  const cek = concatKDF({
    sharedSecret,
    keyLength: 256,
    algorithmID: 'A256GCM',
    partyUInfo: header.apu != null ? fromB64U(header.apu) : new Uint8Array(0),
    partyVInfo: header.apv != null ? fromB64U(header.apv) : new Uint8Array(0),
  })

  // Decode components
  const iv = fromB64U(encodedIV)
  const ciphertext = fromB64U(encodedCiphertext)
  const tag = fromB64U(encodedTag)

  // Reconstruct ciphertext+tag (GCM expects them concatenated)
  const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length)
  ciphertextWithTag.set(ciphertext)
  ciphertextWithTag.set(tag, ciphertext.length)

  // AAD is the ASCII bytes of the encoded header
  const aad = new TextEncoder().encode(encodedHeader)

  // Decrypt with AES-256-GCM
  const cipher = gcm(cek, iv, aad)
  return cipher.decrypt(ciphertextWithTag)
}
