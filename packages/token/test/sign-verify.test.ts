import { ed25519 } from '@noble/curves/ed25519.js'
import { p256 } from '@noble/curves/nist.js'
import { describe, expect, test } from 'vitest'

import { createFullIdentity, randomIdentity } from '../src/identity.js'
import { randomPrivateKey } from '../src/signer.js'
import { verifyToken } from '../src/token.js'
import { getVerifier } from '../src/verifier.js'

describe('createFullIdentity()', () => {
  test('returns the same id for the same private key', () => {
    const privateKey = randomPrivateKey()
    const identity1 = createFullIdentity(privateKey)
    const identity2 = createFullIdentity(privateKey)
    expect(identity2.id).toBe(identity1.id)
  })
})

describe('randomIdentity()', () => {
  test('returns a random identity', () => {
    const identity1 = randomIdentity()
    const identity2 = randomIdentity()
    expect(identity2.id).not.toBe(identity1.id)
  })
})

describe('sign and verify', () => {
  test('EdDSA round-trip via identity', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({ test: true })
    const verified = await verifyToken(token)
    expect(verified.payload.test).toBe(true)
    expect(verified.payload.iss).toBe(identity.id)
  })

  test('EdDSA low-level signature', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)
    const message = new Uint8Array([1, 2, 3])
    const signature = ed25519.sign(message, privateKey)
    const verify = getVerifier('EdDSA')
    const verified = await verify(signature, message, publicKey)
    expect(verified).toBe(true)
    const failed = await verify(signature, message, new Uint8Array(32))
    expect(failed).toBe(false)
  })

  test('ES256 low-level signature', async () => {
    const { publicKey, secretKey } = p256.keygen()
    const message = new Uint8Array([1, 2, 3])
    const signature = p256.sign(message, secretKey)
    const verify = getVerifier('ES256')
    const verified = await verify(signature, message, publicKey)
    expect(verified).toBe(true)
    const failed = await verify(signature, message, p256.keygen().publicKey)
    expect(failed).toBe(false)
  })
})
