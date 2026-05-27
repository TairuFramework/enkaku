import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, it, test } from 'vitest'

import type {
  DecryptingIdentity,
  FullIdentity,
  Identity,
  SigningIdentity,
} from '../src/identity.js'
import {
  createFullIdentity,
  createIdentity,
  createSigningIdentity,
  isDecryptingIdentity,
  isFullIdentity,
  isSigningIdentity,
  randomIdentity,
} from '../src/identity.js'
import { verifyToken } from '../src/token.js'

describe('identity type guards', () => {
  test('isSigningIdentity returns true for signing identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
      publicKey: new Uint8Array(),
      signToken: async () => ({}) as never,
    }
    expect(isSigningIdentity(identity)).toBe(true)
  })

  test('isSigningIdentity returns false for plain identity', () => {
    const identity: Identity = { id: 'did:key:z123' }
    expect(isSigningIdentity(identity)).toBe(false)
  })

  test('isDecryptingIdentity returns true for decrypting identity', () => {
    const identity: DecryptingIdentity = {
      id: 'did:key:z123',
      decrypt: async () => new Uint8Array(),
      agreeKey: async () => new Uint8Array(),
    }
    expect(isDecryptingIdentity(identity)).toBe(true)
  })

  test('isDecryptingIdentity returns false for signing-only identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
      publicKey: new Uint8Array(),
      signToken: async () => ({}) as never,
    }
    expect(isDecryptingIdentity(identity)).toBe(false)
  })

  test('isFullIdentity returns true for full identity', () => {
    const identity: FullIdentity = {
      id: 'did:key:z123',
      publicKey: new Uint8Array(),
      signToken: async () => ({}) as never,
      decrypt: async () => new Uint8Array(),
      agreeKey: async () => new Uint8Array(),
    }
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('isFullIdentity returns false for signing-only identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
      publicKey: new Uint8Array(),
      signToken: async () => ({}) as never,
    }
    expect(isFullIdentity(identity)).toBe(false)
  })
})

describe('createSigningIdentity', () => {
  test('creates a signing identity from Ed25519 private key', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const identity = createSigningIdentity(privateKey)
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isSigningIdentity(identity)).toBe(true)
    const token = await identity.signToken({ test: true })
    expect(token.payload.iss).toBe(identity.id)
    // Verify the token is cryptographically valid
    const verified = await verifyToken(token)
    expect(verified).toBeDefined()
  })

  test('rejects payload with mismatched issuer using generic error', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const identity = createSigningIdentity(privateKey)
    await expect(identity.signToken({ iss: 'did:key:wrong' })).rejects.toThrow(
      'Invalid payload: issuer does not match signer',
    )
  })
})

describe('createFullIdentity', () => {
  test('creates a full identity from Ed25519 private key', () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const identity = createFullIdentity(privateKey)
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('same private key produces same id', () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const id1 = createFullIdentity(privateKey)
    const id2 = createFullIdentity(privateKey)
    expect(id2.id).toBe(id1.id)
  })
})

describe('randomIdentity', () => {
  test('generates a random identity with private key', () => {
    const identity = randomIdentity()
    expect(identity.id).toMatch(/^did:key:z/)
    expect(identity.privateKey).toBeInstanceOf(Uint8Array)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('generates unique identities', () => {
    const id1 = randomIdentity()
    const id2 = randomIdentity()
    expect(id2.id).not.toBe(id1.id)
  })
})

describe('MultiKeyIdentity.sign first-per-aud long-form policy', () => {
  it('uses long form on first token to a new aud, short form thereafter', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const aud = 'did:example:bob'
    const t1 = await identity.sign({ sub: identity.did, aud })
    expect(t1.payload.iss).toBe(identity.longForm)
    const t2 = await identity.sign({ sub: identity.did, aud })
    expect(t2.payload.iss).toBe(identity.did) // short form
  })

  it('uses long form again for a different aud', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    await identity.sign({ sub: identity.did, aud: 'did:example:bob' })
    const t = await identity.sign({ sub: identity.did, aud: 'did:example:alice' })
    expect(t.payload.iss).toBe(identity.longForm)
  })

  it('uses short form by default when payload has no aud', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const t = await identity.sign({ sub: identity.did })
    expect(t.payload.iss).toBe(identity.did)
  })

  it('embedLongForm:true forces long form even on repeat aud', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const aud = 'did:example:bob'
    await identity.sign({ sub: identity.did, aud })
    const t = await identity.sign({ sub: identity.did, aud }, { embedLongForm: true })
    expect(t.payload.iss).toBe(identity.longForm)
  })

  it('embedLongForm:false forces short form even on first contact', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const t = await identity.sign(
      { sub: identity.did, aud: 'did:example:bob' },
      { embedLongForm: false },
    )
    expect(t.payload.iss).toBe(identity.did)
  })

  it('treats long-form and short-form of the same peer4 aud as the same peer (sentTo normalization)', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    // Peer whose long-form and short-form are both valid representations
    const peerIdentity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const peerLong = peerIdentity.longForm
    const peerShort = peerIdentity.did

    // First sign: long-form aud → should use long-form iss
    const t1 = await identity.sign({ sub: identity.did, aud: peerLong })
    expect(t1.payload.iss).toBe(identity.longForm)

    // Second sign: short-form aud (same identity) → sentTo already has normalizedAud; use short-form iss
    const t2 = await identity.sign({ sub: identity.did, aud: peerShort })
    expect(t2.payload.iss).toBe(identity.did)
  })

  it('did:key identities always use short form (longForm === did)', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const t1 = await identity.sign({ sub: identity.did, aud: 'did:example:bob' })
    expect(t1.payload.iss).toBe(identity.did)
    const t2 = await identity.sign(
      { sub: identity.did, aud: 'did:example:bob' },
      { embedLongForm: true },
    )
    expect(t2.payload.iss).toBe(identity.did)
  })
})
