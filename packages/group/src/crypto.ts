/**
 * Pure @noble/* CryptoProvider for ts-mls.
 *
 * Replaces @hpke/core (which requires crypto.subtle) with direct use of:
 * - @noble/curves for X25519 ECDH and Ed25519 signatures
 * - @noble/hashes for SHA-256/384/512 and HKDF
 * - @noble/ciphers for AES-GCM
 *
 * This enables ts-mls to run on Hermes (React Native) where crypto.subtle is unavailable.
 */
import { createRuntime, type Runtime } from '@enkaku/runtime'
import { gcm } from '@noble/ciphers/aes.js'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { expand as hkdfExpand, extract as hkdfExtract } from '@noble/hashes/hkdf.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js'
import type { CiphersuiteImpl, CryptoProvider, Hash, Hpke, Kdf, Rng, Signature } from 'ts-mls'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is within bounds
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

function concatBytes(...arrays: Array<Uint8Array>): Uint8Array {
  let totalLen = 0
  for (const a of arrays) totalLen += a.length
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}

function i2osp(value: number, w: number): Uint8Array {
  const result = new Uint8Array(w)
  let n = value
  for (let i = w - 1; i >= 0 && n > 0; i--) {
    result[i] = n & 0xff
    n >>>= 8
  }
  return result
}

type HashFn = typeof sha256 | typeof sha384 | typeof sha512

function getHashFn(name: string): { hash: HashFn; size: number } {
  // Normalize: ts-mls uses both "SHA-256" and "SHA256" (from HKDF-SHA256)
  const normalized = name.replace('-', '')
  switch (normalized) {
    case 'SHA256':
      return { hash: sha256, size: 32 }
    case 'SHA384':
      return { hash: sha384, size: 48 }
    case 'SHA512':
      return { hash: sha512, size: 64 }
    default:
      throw new Error(`Unsupported hash: ${name}`)
  }
}

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

function makeHash(hashName: string): Hash {
  const { hash } = getHashFn(hashName)
  return {
    async digest(data: Uint8Array): Promise<Uint8Array> {
      return hash(data)
    },
    async mac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
      return hmac(hash, key, data)
    },
    async verifyMac(key: Uint8Array, mac: Uint8Array, data: Uint8Array): Promise<boolean> {
      const expected = hmac(hash, key, data)
      return constantTimeEqual(mac, expected)
    },
  }
}

// ---------------------------------------------------------------------------
// KDF (HKDF)
// ---------------------------------------------------------------------------

function makeKdf(kdfName: string): Kdf {
  const { hash, size } = getHashFn(kdfName.replace('HKDF-', ''))
  return {
    async extract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
      return hkdfExtract(hash, ikm, salt)
    },
    async expand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
      return hkdfExpand(hash, prk, info, len)
    },
    size,
  }
}

// ---------------------------------------------------------------------------
// Signature (Ed25519)
// ---------------------------------------------------------------------------

function makeSignature(sigName: string): Signature {
  if (sigName !== 'Ed25519') {
    throw new Error(`Unsupported signature algorithm: ${sigName}. Only Ed25519 is supported.`)
  }
  return {
    async sign(signKey: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
      return ed25519.sign(message, signKey)
    },
    async verify(
      publicKey: Uint8Array,
      message: Uint8Array,
      signature: Uint8Array,
    ): Promise<boolean> {
      return ed25519.verify(signature, message, publicKey)
    },
    async keygen(): Promise<{ publicKey: Uint8Array; signKey: Uint8Array }> {
      const signKey = ed25519.utils.randomSecretKey()
      return { signKey, publicKey: ed25519.getPublicKey(signKey) }
    },
  }
}

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

function makeRng(runtime: Runtime, customRandomBytes?: (n: number) => Uint8Array): Rng {
  if (customRandomBytes != null) {
    return { randomBytes: customRandomBytes }
  }
  return {
    randomBytes(n: number): Uint8Array {
      return runtime.getRandomValues(new Uint8Array(n))
    },
  }
}

// ---------------------------------------------------------------------------
// HPKE (RFC 9180) — X25519 KEM + HKDF + AES-GCM
// ---------------------------------------------------------------------------

// HPKE constants for X25519
const KEM_ID_X25519 = 0x0020
const KEM_SUITE_ID = concatBytes(new TextEncoder().encode('KEM'), i2osp(KEM_ID_X25519, 2))

/**
 * Labeled Extract (RFC 9180 §4)
 */
function labeledExtract(
  hash: HashFn,
  salt: Uint8Array,
  label: string,
  ikm: Uint8Array,
  suiteID: Uint8Array,
): Uint8Array {
  const labeledIKM = concatBytes(
    new TextEncoder().encode('HPKE-v1'),
    suiteID,
    new TextEncoder().encode(label),
    ikm,
  )
  return hkdfExtract(hash, labeledIKM, salt)
}

/**
 * Labeled Expand (RFC 9180 §4)
 */
function labeledExpand(
  hash: HashFn,
  prk: Uint8Array,
  label: string,
  info: Uint8Array,
  len: number,
  suiteID: Uint8Array,
): Uint8Array {
  const labeledInfo = concatBytes(
    i2osp(len, 2),
    new TextEncoder().encode('HPKE-v1'),
    suiteID,
    new TextEncoder().encode(label),
    info,
  )
  return hkdfExpand(hash, prk, labeledInfo, len)
}

/**
 * ExtractAndExpand (RFC 9180 §4.1)
 */
function extractAndExpand(
  hash: HashFn,
  dh: Uint8Array,
  kemContext: Uint8Array,
  suiteID: Uint8Array,
  nSecret: number,
): Uint8Array {
  const prk = labeledExtract(hash, new Uint8Array(0), 'shared_secret', dh, suiteID)
  return labeledExpand(hash, prk, 'shared_secret', kemContext, nSecret, suiteID)
}

/**
 * DeriveKeyPair (RFC 9180 §7.1.3 — X25519)
 */
function deriveKeyPairX25519(
  hash: HashFn,
  ikm: Uint8Array,
): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const dkpPRK = labeledExtract(hash, new Uint8Array(0), 'dkp_prk', ikm, KEM_SUITE_ID)
  const sk = labeledExpand(hash, dkpPRK, 'sk', new Uint8Array(0), 32, KEM_SUITE_ID)
  const pk = x25519.getPublicKey(sk)
  return { privateKey: sk, publicKey: pk }
}

type HpkeAlg = {
  kem: string
  aead: string
  kdf: string
}

function makeHpke(hpkeAlg: HpkeAlg): Hpke {
  if (!hpkeAlg.kem.includes('X25519')) {
    throw new Error(`Unsupported KEM: ${hpkeAlg.kem}. Only DHKEM-X25519-HKDF-SHA256 is supported.`)
  }

  const { hash: kemHash } = getHashFn('SHA-256') // X25519 KEM always uses SHA-256
  const nSecret = 32 // SHA-256 output length

  // AEAD parameters
  const aeadKeySize = hpkeAlg.aead === 'AES256GCM' ? 32 : 16
  const aeadNonceSize = 12

  // HPKE suite ID for the full suite (KDF + AEAD)
  const kdfID =
    hpkeAlg.kdf === 'HKDF-SHA256' ? 0x0001 : hpkeAlg.kdf === 'HKDF-SHA384' ? 0x0002 : 0x0003
  const aeadID =
    hpkeAlg.aead === 'AES128GCM' ? 0x0001 : hpkeAlg.aead === 'AES256GCM' ? 0x0002 : 0x0003
  const hpkeSuiteID = concatBytes(
    new TextEncoder().encode('HPKE'),
    i2osp(KEM_ID_X25519, 2),
    i2osp(kdfID, 2),
    i2osp(aeadID, 2),
  )

  const { hash: kdfHash } = getHashFn(hpkeAlg.kdf.replace('HKDF-', ''))

  // Opaque key wrappers — ts-mls expects CryptoKey-like objects but we use raw bytes
  type NobleKey = { raw: Uint8Array; type: string }

  function wrapPrivateKey(raw: Uint8Array): NobleKey {
    return { raw, type: 'private' }
  }

  function wrapPublicKey(raw: Uint8Array): NobleKey {
    return { raw, type: 'public' }
  }

  function unwrapKey(key: unknown): Uint8Array {
    if (key == null || typeof key !== 'object' || !('raw' in key)) {
      throw new Error('Invalid key: expected a wrapped key object with raw Uint8Array')
    }
    return (key as NobleKey).raw
  }

  /**
   * Encap (RFC 9180 §4.1) — generate ephemeral keypair and shared secret
   */
  function encap(recipientPublicKey: Uint8Array): { sharedSecret: Uint8Array; enc: Uint8Array } {
    const ek = x25519.utils.randomSecretKey()
    const enc = x25519.getPublicKey(ek)
    const dh = x25519.getSharedSecret(ek, recipientPublicKey)
    const kemContext = concatBytes(enc, recipientPublicKey)
    const sharedSecret = extractAndExpand(kemHash, dh, kemContext, KEM_SUITE_ID, nSecret)
    return { sharedSecret, enc }
  }

  /**
   * Decap (RFC 9180 §4.1) — derive shared secret from received enc
   */
  function decap(enc: Uint8Array, recipientPrivateKey: Uint8Array): Uint8Array {
    const dh = x25519.getSharedSecret(recipientPrivateKey, enc)
    const recipientPublicKey = x25519.getPublicKey(recipientPrivateKey)
    const kemContext = concatBytes(enc, recipientPublicKey)
    return extractAndExpand(kemHash, dh, kemContext, KEM_SUITE_ID, nSecret)
  }

  /**
   * KeySchedule (RFC 9180 §5.1)
   */
  function keySchedule(
    sharedSecret: Uint8Array,
    info: Uint8Array,
  ): { key: Uint8Array; baseNonce: Uint8Array; exporterSecret: Uint8Array } {
    const mode = 0 // mode_base
    const pskIDHash = labeledExtract(
      kdfHash,
      new Uint8Array(0),
      'psk_id_hash',
      new Uint8Array(0),
      hpkeSuiteID,
    )
    const infoHash = labeledExtract(kdfHash, new Uint8Array(0), 'info_hash', info, hpkeSuiteID)
    const ksContext = concatBytes(new Uint8Array([mode]), pskIDHash, infoHash)

    const secret = labeledExtract(kdfHash, sharedSecret, 'secret', new Uint8Array(0), hpkeSuiteID)
    const key = labeledExpand(kdfHash, secret, 'key', ksContext, aeadKeySize, hpkeSuiteID)
    const baseNonce = labeledExpand(
      kdfHash,
      secret,
      'base_nonce',
      ksContext,
      aeadNonceSize,
      hpkeSuiteID,
    )
    const exporterSecret = labeledExpand(
      kdfHash,
      secret,
      'exp',
      ksContext,
      kdfHash.outputLen,
      hpkeSuiteID,
    )
    return { key, baseNonce, exporterSecret }
  }

  function aeadEncrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    aad: Uint8Array,
    plaintext: Uint8Array,
  ): Uint8Array {
    const cipher = gcm(key, nonce, aad)
    return cipher.encrypt(plaintext)
  }

  function aeadDecrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    aad: Uint8Array,
    ciphertext: Uint8Array,
  ): Uint8Array {
    const cipher = gcm(key, nonce, aad)
    return cipher.decrypt(ciphertext)
  }

  return {
    async seal(
      publicKey: unknown,
      plaintext: Uint8Array,
      info: Uint8Array,
      aad?: Uint8Array,
    ): Promise<{ ct: Uint8Array; enc: Uint8Array }> {
      const { sharedSecret, enc } = encap(unwrapKey(publicKey))
      const { key, baseNonce } = keySchedule(sharedSecret, info)
      const ct = aeadEncrypt(key, baseNonce, aad ?? new Uint8Array(0), plaintext)
      return { ct, enc }
    },

    async open(
      privateKey: unknown,
      kemOutput: Uint8Array,
      ciphertext: Uint8Array,
      info: Uint8Array,
      aad?: Uint8Array,
    ): Promise<Uint8Array> {
      const sharedSecret = decap(kemOutput, unwrapKey(privateKey))
      const { key, baseNonce } = keySchedule(sharedSecret, info)
      return aeadDecrypt(key, baseNonce, aad ?? new Uint8Array(0), ciphertext)
    },

    async importPrivateKey(k: Uint8Array): Promise<unknown> {
      return wrapPrivateKey(k)
    },

    async importPublicKey(k: Uint8Array): Promise<unknown> {
      return wrapPublicKey(k)
    },

    async exportPublicKey(k: unknown): Promise<Uint8Array> {
      return unwrapKey(k)
    },

    async exportPrivateKey(k: unknown): Promise<Uint8Array> {
      return unwrapKey(k)
    },

    async encryptAead(
      key: Uint8Array,
      nonce: Uint8Array,
      aad: Uint8Array | undefined,
      plaintext: Uint8Array,
    ): Promise<Uint8Array> {
      return aeadEncrypt(key, nonce, aad ?? new Uint8Array(0), plaintext)
    },

    async decryptAead(
      key: Uint8Array,
      nonce: Uint8Array,
      aad: Uint8Array | undefined,
      ciphertext: Uint8Array,
    ): Promise<Uint8Array> {
      return aeadDecrypt(key, nonce, aad ?? new Uint8Array(0), ciphertext)
    },

    async exportSecret(
      publicKey: unknown,
      exporterContext: Uint8Array,
      length: number,
      info: Uint8Array,
    ): Promise<{ enc: Uint8Array; secret: Uint8Array }> {
      const { sharedSecret, enc } = encap(unwrapKey(publicKey))
      const { exporterSecret } = keySchedule(sharedSecret, info)
      const secret = labeledExpand(
        kdfHash,
        exporterSecret,
        'sec',
        exporterContext,
        length,
        hpkeSuiteID,
      )
      return { enc, secret }
    },

    async importSecret(
      privateKey: unknown,
      exporterContext: Uint8Array,
      kemOutput: Uint8Array,
      length: number,
      info: Uint8Array,
    ): Promise<Uint8Array> {
      const sharedSecret = decap(kemOutput, unwrapKey(privateKey))
      const { exporterSecret } = keySchedule(sharedSecret, info)
      return labeledExpand(kdfHash, exporterSecret, 'sec', exporterContext, length, hpkeSuiteID)
    },

    async deriveKeyPair(ikm: Uint8Array): Promise<{ privateKey: unknown; publicKey: unknown }> {
      const { privateKey, publicKey } = deriveKeyPairX25519(kemHash, ikm)
      return { privateKey: wrapPrivateKey(privateKey), publicKey: wrapPublicKey(publicKey) }
    },

    async generateKeyPair(): Promise<{ privateKey: unknown; publicKey: unknown }> {
      const privateKey = x25519.utils.randomSecretKey()
      const publicKey = x25519.getPublicKey(privateKey)
      return { privateKey: wrapPrivateKey(privateKey), publicKey: wrapPublicKey(publicKey) }
    },

    keyLength: aeadKeySize,
    nonceLength: aeadNonceSize,
  } as Hpke
}

// ---------------------------------------------------------------------------
// CryptoProvider
// ---------------------------------------------------------------------------

type CiphersuiteConfig = {
  hash: string
  hpke: HpkeAlg
  signature: string
}

// Lookup from numeric ciphersuite ID to algorithm configuration.
// We only support the ciphersuites that use X25519 + Ed25519 (noble-compatible).
const CIPHERSUITE_CONFIGS: Record<number, CiphersuiteConfig> = {
  // MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
  1: {
    hash: 'SHA-256',
    hpke: { kem: 'DHKEM-X25519-HKDF-SHA256', kdf: 'HKDF-SHA256', aead: 'AES128GCM' },
    signature: 'Ed25519',
  },
  // MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519
  3: {
    hash: 'SHA-256',
    hpke: { kem: 'DHKEM-X25519-HKDF-SHA256', kdf: 'HKDF-SHA256', aead: 'CHACHA20POLY1305' },
    signature: 'Ed25519',
  },
}

export type NobleCryptoProviderOptions = {
  /** Custom random bytes function. Defaults to runtime.getRandomValues. */
  randomBytes?: (n: number) => Uint8Array
  /** Runtime providing platform primitives. Defaults to createRuntime(). */
  runtime?: Runtime
}

export function createNobleCryptoProvider(options?: NobleCryptoProviderOptions): CryptoProvider {
  const runtime = options?.runtime ?? createRuntime()
  const rng = makeRng(runtime, options?.randomBytes)
  return {
    async getCiphersuiteImpl(id: number): Promise<CiphersuiteImpl> {
      const config = CIPHERSUITE_CONFIGS[id]
      if (config == null) {
        throw new Error(
          `Unsupported ciphersuite ID: ${id}. Only X25519+Ed25519 suites (IDs 1, 3) are supported.`,
        )
      }
      return {
        hash: makeHash(config.hash),
        kdf: makeKdf(config.hpke.kdf),
        signature: makeSignature(config.signature),
        hpke: makeHpke(config.hpke),
        rng,
        id,
      }
    },
  }
}

/** Default noble CryptoProvider using the default runtime for RNG. */
export const nobleCryptoProvider: CryptoProvider = createNobleCryptoProvider()
