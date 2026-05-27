import { createIdentity, getSignatureInfo, randomIdentity } from '@enkaku/token'
import { ed25519 } from '@noble/curves/ed25519.js'
import { defaultCredentialTypes } from 'ts-mls'
import { describe, expect, test } from 'vitest'

import { createDIDAuthenticationService } from '../src/authentication.js'
import { makeMLSCredential } from '../src/group.js'

describe('createDIDAuthenticationService', () => {
  const authService = createDIDAuthenticationService()

  test('validates matching DID and public key from JSON credential', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const credential = makeMLSCredential(alice)
    const result = await authService.validateCredential(credential, alice.publicKey)
    expect(result).toBe(true)
  })

  test('rejects mismatched public key with JSON credential', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const credential = makeMLSCredential(alice)
    const result = await authService.validateCredential(credential, bob.publicKey)
    expect(result).toBe(false)
  })

  test('returns false for non-basic credential type', async () => {
    const alice = randomIdentity()
    const [, expectedPublicKey] = getSignatureInfo(alice.id)

    // x509 credential type (2) — not supported
    const mlsCredential = {
      credentialType: 2 as const,
      certificates: [new Uint8Array(0)],
    }

    const result = await authService.validateCredential(
      mlsCredential as unknown as { credentialType: 1; identity: Uint8Array },
      expectedPublicKey,
    )
    expect(result).toBe(false)
  })

  test('returns false for invalid DID in identity', async () => {
    const alice = randomIdentity()
    const [, expectedPublicKey] = getSignatureInfo(alice.id)

    const identity = new TextEncoder().encode('not-a-did')
    const mlsCredential = { credentialType: 1 as const, identity }

    const result = await authService.validateCredential(mlsCredential, expectedPublicKey)
    expect(result).toBe(false)
  })

  test('uses ed25519 public key derived from identity privateKey', async () => {
    // Verify the public key from getSignatureInfo matches ed25519.getPublicKey
    const alice = randomIdentity()
    const publicKeyFromEd25519 = ed25519.getPublicKey(alice.privateKey)
    const [, publicKeyFromDID] = getSignatureInfo(alice.id)

    expect(publicKeyFromDID).toEqual(publicKeyFromEd25519)

    // And that the auth service accepts this via makeMLSCredential
    const credential = makeMLSCredential(alice)
    const result = await authService.validateCredential(credential, publicKeyFromEd25519)
    expect(result).toBe(true)
  })
})

describe('createDIDAuthenticationService — peer4', () => {
  test('accepts a peer4 single-sig leaf bound to the doc verification method', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, identity.publicKey)
    expect(ok).toBe(true)
  })

  test('accepts a peer4 multi-sig leaf bound to a non-primary key', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'sig', alg: 'EdDSA' },
      ],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    const service = createDIDAuthenticationService()
    const sigKeys = identity.keys.filter((k) => k.purpose === 'sig')
    if (sigKeys.length < 2) throw new Error('expected at least 2 sig keys')
    const ok = await service.validateCredential(credential, sigKeys[1].publicKey)
    expect(ok).toBe(true)
  })

  test('rejects when peer4 credential is missing longForm', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bytes = new TextEncoder().encode(JSON.stringify({ id: identity.id }))
    const credential = { credentialType: defaultCredentialTypes.basic, identity: bytes }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, identity.publicKey)
    expect(ok).toBe(false)
  })

  test('rejects when longForm short form does not match id (hash-binding tamper)', async () => {
    const a = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const b = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bytes = new TextEncoder().encode(JSON.stringify({ id: a.id, longForm: b.longForm }))
    const credential = { credentialType: defaultCredentialTypes.basic, identity: bytes }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, a.publicKey)
    expect(ok).toBe(false)
  })

  test('rejects when the leaf sig key is not in the doc', async () => {
    const a = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const wrongKey = new Uint8Array(32)
    const credential = makeMLSCredential(a)
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, wrongKey)
    expect(ok).toBe(false)
  })

  test('rejects non-JSON identity bytes', async () => {
    const credential = {
      credentialType: defaultCredentialTypes.basic,
      identity: new TextEncoder().encode('not-json'),
    }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, new Uint8Array(32))
    expect(ok).toBe(false)
  })

  test('accepts a peer4 identity with mixed sig + kem keys (sig key binds, kem key ignored)', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    const service = createDIDAuthenticationService()
    // Sig key still binds despite a KEM key being present in verificationMethod.
    expect(await service.validateCredential(credential, identity.publicKey)).toBe(true)
    // KEM key (X25519, codec 0xec 0x01) MUST NOT bind even if its raw bytes
    // happened to be presented as the leaf signature key — it isn't listed in
    // doc.authentication.
    const kemKey = identity.keys.find((k) => k.purpose === 'kem')
    if (kemKey == null) throw new Error('expected a kem key')
    expect(await service.validateCredential(credential, kemKey.publicKey)).toBe(false)
  })

  test('rejects when peer4 doc has no authentication entries', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    // Craft a synthetic peer4 doc that has the sig key in verificationMethod
    // but lacks the authentication array entirely. The auth service must
    // reject because no VM is authorized to sign.
    const { encodePeer4 } = await import('@enkaku/token')
    const sigKey = identity.keys.find((k) => k.purpose === 'sig')
    if (sigKey == null) throw new Error('expected a sig key')
    const tamperedDoc = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: identity.doc.verificationMethod,
      // no `authentication`
    }
    const { longForm, shortForm } = encodePeer4(tamperedDoc)
    const bytes = new TextEncoder().encode(JSON.stringify({ id: shortForm, longForm }))
    const credential = { credentialType: defaultCredentialTypes.basic, identity: bytes }
    const service = createDIDAuthenticationService()
    expect(await service.validateCredential(credential, sigKey.publicKey)).toBe(false)
  })

  test('rejects non-basic credential type', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = {
      credentialType: 99 as unknown as typeof defaultCredentialTypes.basic,
      identity: (makeMLSCredential(identity) as { identity: Uint8Array }).identity,
    }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, identity.publicKey)
    expect(ok).toBe(false)
  })
})
