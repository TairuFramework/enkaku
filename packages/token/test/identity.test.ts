import { describe, expect, test } from 'vitest'

import type {
  DecryptingIdentity,
  FullIdentity,
  Identity,
  SigningIdentity,
} from '../src/identity.js'
import { isDecryptingIdentity, isFullIdentity, isSigningIdentity } from '../src/identity.js'

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
