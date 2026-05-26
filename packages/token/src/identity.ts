import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'

import { CODECS, getDID } from './did.js'
import { decryptToken } from './jwe.js'
import { encodeMultibase } from './multibase.js'
import { type DIDDoc, encodePeer4, isPeer4 } from './peer4.js'
import type { SignedHeader } from './schemas.js'
import type { SignedToken } from './types.js'

const tracer = createTracer('token')

export type Identity = { readonly id: string }

export type SigningIdentity = Identity & {
  publicKey: Uint8Array
  signToken: <
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(
    payload: Payload,
    header?: Header,
  ) => Promise<SignedToken<Payload, Header>>
}

export type DecryptingIdentity = Identity & {
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array>
}

export type FullIdentity = SigningIdentity & DecryptingIdentity

export type OwnIdentity = FullIdentity & { privateKey: Uint8Array }

export type IdentityProvider<T extends SigningIdentity = SigningIdentity> = {
  provideIdentity(keyID: string): Promise<T>
}

export function isSigningIdentity(identity: Identity): identity is SigningIdentity {
  return (
    'publicKey' in identity &&
    'signToken' in identity &&
    typeof (identity as SigningIdentity).signToken === 'function'
  )
}

export function isDecryptingIdentity(identity: Identity): identity is DecryptingIdentity {
  return (
    'decrypt' in identity &&
    typeof (identity as DecryptingIdentity).decrypt === 'function' &&
    'agreeKey' in identity &&
    typeof (identity as DecryptingIdentity).agreeKey === 'function'
  )
}

export function isFullIdentity(identity: Identity): identity is FullIdentity {
  return isSigningIdentity(identity) && isDecryptingIdentity(identity)
}

export function isOwnIdentity(identity: Identity): identity is OwnIdentity {
  return isFullIdentity(identity) && 'privateKey' in identity
}

/**
 * Create a signing identity from an Ed25519 private key.
 */
export function createSigningIdentity(privateKey: Uint8Array): SigningIdentity {
  const publicKey = ed25519.getPublicKey(privateKey)
  const id = getDID(CODECS.EdDSA, publicKey)

  async function signToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    return withSpan(
      tracer,
      SpanNames.TOKEN_SIGN,
      { attributes: { [AttributeKeys.AUTH_DID]: id, [AttributeKeys.AUTH_ALGORITHM]: 'EdDSA' } },
      async () => {
        if (payload.iss != null && payload.iss !== id) {
          throw new Error('Invalid payload: issuer does not match signer')
        }

        const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
        const fullPayload = { ...payload, iss: id }
        const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

        return {
          header: fullHeader,
          payload: fullPayload,
          signature: toB64U(ed25519.sign(fromUTF(data), privateKey)),
          data,
        }
      },
    )
  }

  return { id, publicKey, signToken }
}

/**
 * Create a decrypting identity from an Ed25519 private key.
 * Uses X25519 key derivation for ECDH key agreement.
 */
export function createDecryptingIdentity(privateKey: Uint8Array): DecryptingIdentity {
  const publicKey = ed25519.getPublicKey(privateKey)
  const id = getDID(CODECS.EdDSA, publicKey)
  const x25519Private = ed25519.utils.toMontgomerySecret(privateKey)

  async function decrypt(jwe: string): Promise<Uint8Array> {
    return decryptToken({ id, decrypt, agreeKey }, jwe)
  }

  async function agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array> {
    return x25519.getSharedSecret(x25519Private, ephemeralPublicKey)
  }

  return { id, decrypt, agreeKey }
}

/**
 * Create a full identity (signing + decrypting) from an Ed25519 private key.
 */
export function createFullIdentity(privateKey: Uint8Array): FullIdentity {
  const signing = createSigningIdentity(privateKey)
  const decrypting = createDecryptingIdentity(privateKey)
  return { ...signing, ...decrypting }
}

/**
 * Generate a random identity with a new Ed25519 private key.
 */
export function randomIdentity(): OwnIdentity {
  const privateKey = ed25519.utils.randomSecretKey()
  return { ...createFullIdentity(privateKey), privateKey }
}

// ─── createIdentity builder ────────────────────────────────────────────────

export type KeyPurpose = 'sig' | 'kem'
export type KeyAlg = 'EdDSA' | 'X25519'

export type IdentityKeySpec = {
  purpose: KeyPurpose
  alg: KeyAlg
  privateKey?: Uint8Array
}

export type CreateIdentityInput = {
  keys: Array<IdentityKeySpec>
  didMethod?: 'key' | 'peer:4'
}

export type ResolvedKey = {
  fragment: string
  alg: KeyAlg
  purpose: KeyPurpose
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export type SignOptions = {
  kid?: string
}

export type MultiKeyIdentity = {
  did: string
  longForm: string
  doc: DIDDoc
  keys: Array<ResolvedKey>
  sign<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options?: SignOptions,
  ): Promise<SignedToken<Payload>>
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array, kid?: string): Promise<Uint8Array>
}

const CODEC_ED25519_PUB = new Uint8Array([0xed, 0x01])
const CODEC_X25519_PUB = new Uint8Array([0xec, 0x01])

function codecFor(alg: KeyAlg): Uint8Array {
  switch (alg) {
    case 'EdDSA':
      return CODEC_ED25519_PUB
    case 'X25519':
      return CODEC_X25519_PUB
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function publicKeyMultibase(alg: KeyAlg, publicKey: Uint8Array): string {
  return encodeMultibase(concatBytes(codecFor(alg), publicKey))
}

function generateKeyPair(
  alg: KeyAlg,
  providedPrivate?: Uint8Array,
): { privateKey: Uint8Array; publicKey: Uint8Array } {
  switch (alg) {
    case 'EdDSA': {
      const priv = providedPrivate ?? ed25519.utils.randomSecretKey()
      return { privateKey: priv, publicKey: ed25519.getPublicKey(priv) }
    }
    case 'X25519': {
      const priv = providedPrivate ?? x25519.utils.randomSecretKey()
      return { privateKey: priv, publicKey: x25519.getPublicKey(priv) }
    }
  }
}

function isClassical(spec: IdentityKeySpec): boolean {
  return spec.alg === 'EdDSA' || spec.alg === 'X25519'
}

function chooseMethod(input: CreateIdentityInput): 'key' | 'peer:4' {
  if (input.didMethod != null) {
    if (input.didMethod === 'key') {
      if (input.keys.length !== 1) {
        throw new Error('IdentityError.InvalidMethod: did:key requires exactly one key')
      }
      if (!isClassical(input.keys[0])) {
        throw new Error('IdentityError.InvalidMethod: did:key requires a classical algorithm')
      }
      if (input.keys[0].purpose !== 'sig') {
        throw new Error('IdentityError.InvalidMethod: did:key requires a signing key')
      }
    }
    return input.didMethod
  }
  if (input.keys.length === 1 && isClassical(input.keys[0]) && input.keys[0].purpose === 'sig') {
    return 'key'
  }
  return 'peer:4'
}

function resolveKeys(input: CreateIdentityInput): Array<ResolvedKey> {
  return input.keys.map((spec, i) => {
    const { privateKey, publicKey } = generateKeyPair(spec.alg, spec.privateKey)
    return {
      fragment: `#key-${i}`,
      alg: spec.alg,
      purpose: spec.purpose,
      privateKey,
      publicKey,
    }
  })
}

function buildDoc(keys: Array<ResolvedKey>): DIDDoc {
  const verificationMethod = keys.map((k) => ({
    id: k.fragment,
    type: 'Multikey',
    publicKeyMultibase: publicKeyMultibase(k.alg, k.publicKey),
  }))
  const authentication = keys.filter((k) => k.purpose === 'sig').map((k) => k.fragment)
  const keyAgreement = keys.filter((k) => k.purpose === 'kem').map((k) => k.fragment)
  const doc: DIDDoc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod,
  }
  if (authentication.length > 0) doc.authentication = authentication
  if (keyAgreement.length > 0) doc.keyAgreement = keyAgreement
  return doc
}

function pickSigningKey(keys: Array<ResolvedKey>, kid?: string): ResolvedKey {
  if (kid != null) {
    const found = keys.find((k) => k.fragment === kid)
    if (found == null) throw new Error(`KidNotFound: ${kid}`)
    if (found.purpose !== 'sig') throw new Error(`Kid is not a signing key: ${kid}`)
    return found
  }
  const first = keys.find((k) => k.purpose === 'sig')
  if (first == null) throw new Error('No signing key in identity')
  return first
}

function signWith(key: ResolvedKey, data: Uint8Array): Uint8Array {
  switch (key.alg) {
    case 'EdDSA':
      return ed25519.sign(data, key.privateKey)
    case 'X25519':
      throw new Error('X25519 cannot sign')
  }
}

function pickKemKey(keys: Array<ResolvedKey>, kid?: string): ResolvedKey {
  if (kid != null) {
    const found = keys.find((k) => k.fragment === kid)
    if (found == null) throw new Error(`KidNotFound: ${kid}`)
    if (found.purpose !== 'kem' || found.alg !== 'X25519') {
      throw new Error(`Kid is not a KEM X25519 key: ${kid}`)
    }
    return found
  }
  const first = keys.find((k) => k.purpose === 'kem' && k.alg === 'X25519')
  if (first == null) throw new Error('No KEM key in identity')
  return first
}

function buildIdentity(
  did: string,
  longForm: string,
  doc: DIDDoc,
  keys: Array<ResolvedKey>,
): MultiKeyIdentity {
  async function sign<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options: SignOptions = {},
  ): Promise<SignedToken<Payload>> {
    const key = pickSigningKey(keys, options.kid)
    const header = {
      typ: 'JWT',
      alg: 'EdDSA',
      ...(isPeer4(did) ? { kid: key.fragment } : {}),
    } as SignedHeader
    const fullPayload = { ...payload, iss: did }
    const data = `${b64uFromJSON(header)}.${b64uFromJSON(fullPayload)}`
    return {
      header: header as SignedHeader & Record<string, unknown>,
      payload: fullPayload as Payload & { iss: string },
      signature: toB64U(signWith(key, fromUTF(data))),
      data,
    } as SignedToken<Payload>
  }

  async function agreeKey(ephemeralPublicKey: Uint8Array, kid?: string): Promise<Uint8Array> {
    const key = pickKemKey(keys, kid)
    return x25519.getSharedSecret(key.privateKey, ephemeralPublicKey)
  }

  async function decrypt(jwe: string): Promise<Uint8Array> {
    pickKemKey(keys)
    return decryptToken({ id: did, decrypt, agreeKey }, jwe)
  }

  return { did, longForm, doc, keys, sign, decrypt, agreeKey }
}

/**
 * Create a multi-key identity. The DID method is chosen automatically:
 * - single classical signing key → did:key
 * - anything else → did:peer:4
 *
 * Caller can override via `didMethod`. Invalid overrides throw IdentityError.InvalidMethod.
 */
export async function createIdentity(input: CreateIdentityInput): Promise<MultiKeyIdentity> {
  if (input.keys.length === 0) {
    throw new Error('createIdentity requires at least one key')
  }
  const method = chooseMethod(input)
  const keys = resolveKeys(input)

  if (method === 'key') {
    const [k] = keys
    const did = getDID(CODECS.EdDSA, k.publicKey)
    const doc: DIDDoc = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [
        {
          id: '#key-0',
          type: 'Multikey',
          publicKeyMultibase: publicKeyMultibase(k.alg, k.publicKey),
        },
      ],
      authentication: ['#key-0'],
    }
    return buildIdentity(did, did, doc, keys)
  }

  const doc = buildDoc(keys)
  const { longForm, shortForm } = encodePeer4(doc)
  return buildIdentity(shortForm, longForm, doc, keys)
}
