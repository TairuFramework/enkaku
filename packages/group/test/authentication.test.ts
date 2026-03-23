import { getSignatureInfo, randomIdentity } from '@enkaku/token'
import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, test } from 'vitest'

import { createDIDAuthenticationService } from '../src/authentication.js'
import type { MemberCredential } from '../src/credential.js'
import { credentialToMLSIdentity } from '../src/credential.js'

describe('createDIDAuthenticationService', () => {
  const authService = createDIDAuthenticationService()

  test('validates matching DID and public key from JSON credential', async () => {
    const alice = randomIdentity()
    const [, expectedPublicKey] = getSignatureInfo(alice.id)

    const credential: MemberCredential = {
      did: alice.id,
      capabilityChain: ['fake-cap'],
      capability: {
        header: { typ: 'JWT' as const, alg: 'EdDSA' as const },
        payload: {
          iss: alice.id,
          sub: alice.id,
          aud: alice.id,
          act: ['*'],
          res: ['*'],
        },
        signature: 'fake',
        data: 'fake',
      },
      permission: 'admin',
      groupID: 'test-group',
    }

    const identity = credentialToMLSIdentity(credential)
    const mlsCredential = { credentialType: 1 as const, identity }

    const result = await authService.validateCredential(mlsCredential, expectedPublicKey)
    expect(result).toBe(true)
  })

  test('rejects mismatched public key with JSON credential', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const [, bobPublicKey] = getSignatureInfo(bob.id)

    const credential: MemberCredential = {
      did: alice.id,
      capabilityChain: ['fake-cap'],
      capability: {
        header: { typ: 'JWT' as const, alg: 'EdDSA' as const },
        payload: {
          iss: alice.id,
          sub: alice.id,
          aud: alice.id,
          act: ['*'],
          res: ['*'],
        },
        signature: 'fake',
        data: 'fake',
      },
      permission: 'admin',
      groupID: 'test-group',
    }

    const identity = credentialToMLSIdentity(credential)
    const mlsCredential = { credentialType: 1 as const, identity }

    const result = await authService.validateCredential(mlsCredential, bobPublicKey)
    expect(result).toBe(false)
  })

  test('validates matching DID and public key from plain DID credential', async () => {
    const alice = randomIdentity()
    const [, expectedPublicKey] = getSignatureInfo(alice.id)

    // Plain DID string in identity (as produced by makeMLSCredential in group.ts)
    const identity = new TextEncoder().encode(alice.id)
    const mlsCredential = { credentialType: 1 as const, identity }

    const result = await authService.validateCredential(mlsCredential, expectedPublicKey)
    expect(result).toBe(true)
  })

  test('rejects mismatched public key with plain DID credential', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const [, bobPublicKey] = getSignatureInfo(bob.id)

    const identity = new TextEncoder().encode(alice.id)
    const mlsCredential = { credentialType: 1 as const, identity }

    const result = await authService.validateCredential(mlsCredential, bobPublicKey)
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

    // And that the auth service accepts this
    const identity = new TextEncoder().encode(alice.id)
    const mlsCredential = { credentialType: 1 as const, identity }

    const result = await authService.validateCredential(mlsCredential, publicKeyFromEd25519)
    expect(result).toBe(true)
  })
})
