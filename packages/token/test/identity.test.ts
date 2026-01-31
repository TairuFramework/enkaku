import { ed25519 } from '@noble/curves/ed25519.js'
import { describe, expect, test } from 'vitest'

import type {
  DecryptingIdentity,
  FullIdentity,
  Identity,
  SigningIdentity,
} from '../src/identity.js'
import {
  createFullIdentity,
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
      signToken: async () => ({}) as never,
    }
    expect(isDecryptingIdentity(identity)).toBe(false)
  })

  test('isFullIdentity returns true for full identity', () => {
    const identity: FullIdentity = {
      id: 'did:key:z123',
      signToken: async () => ({}) as never,
      decrypt: async () => new Uint8Array(),
      agreeKey: async () => new Uint8Array(),
    }
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('isFullIdentity returns false for signing-only identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
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
