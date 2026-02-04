import { ed25519 } from '@noble/curves/ed25519.js'
import { equals } from 'uint8arrays'
import { describe, expect, test } from 'vitest'

import { randomIdentity } from '../src/identity.js'
import {
  createUnsignedToken,
  isSignedToken,
  isUnsignedToken,
  isVerifiedToken,
  signToken,
  verifyToken,
} from '../src/token.js'
import type { VerifiedToken } from '../src/types.js'
import { stringifyToken } from '../src/utils.js'

test('create a signed token and verify it', async () => {
  const identity = randomIdentity()
  const token = await identity.signToken({ test: true })
  expect(isSignedToken(token)).toBe(true)
  expect(token.payload.iss).toBe(identity.id)
  const verified = await verifyToken(token)
  expect(isVerifiedToken(verified)).toBe(true)
  const publicKey = ed25519.getPublicKey(identity.privateKey)
  expect(equals((verified as VerifiedToken<{ test: true }>).verifiedPublicKey, publicKey)).toBe(
    true,
  )
})

test('verifyToken rejects malformed JWT strings', async () => {
  // Too few parts
  await expect(verifyToken('header.payload')).rejects.toThrow('Invalid token format')
  await expect(verifyToken('header')).rejects.toThrow('Invalid token format')
  await expect(verifyToken('')).rejects.toThrow('Invalid token format')

  // Too many parts
  await expect(verifyToken('a.b.c.d')).rejects.toThrow('Invalid token format')
  await expect(verifyToken('a.b.c.d.e')).rejects.toThrow('Invalid token format')
})

test('create an unsigned token, sign and stringify it', async () => {
  const unsigned = createUnsignedToken({ test: true })
  expect(isUnsignedToken(unsigned)).toBe(true)
  const identity = randomIdentity()
  const signed = await signToken(identity, unsigned)
  expect(isSignedToken(signed)).toBe(true)
  const stringified = stringifyToken(signed)
  const verified = await verifyToken(stringified)
  expect(isVerifiedToken(verified)).toBe(true)
})

describe('verifyToken with time validation', () => {
  const fixedTime = 1700000000

  test('rejects expired signed token', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      exp: fixedTime - 100,
    })

    await expect(verifyToken(token, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token expired',
    )
  })

  test('rejects token not yet valid (nbf in future)', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      nbf: fixedTime + 100,
    })

    await expect(verifyToken(token, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token not yet valid',
    )
  })

  test('accepts token within valid time window', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      nbf: fixedTime - 100,
      exp: fixedTime + 100,
    })

    const result = await verifyToken(token, undefined, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('accepts token without time claims', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({ test: true })

    const result = await verifyToken(token, undefined, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('respects clockTolerance option', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      exp: fixedTime - 5, // Expired 5 seconds ago
    })

    // Should fail without tolerance
    await expect(verifyToken(token, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token expired',
    )

    // Should pass with 10 second tolerance
    const result = await verifyToken(token, undefined, {
      atTime: fixedTime,
      clockTolerance: 10,
    })
    expect(result.payload.test).toBe(true)
  })

  test('validates time claims for JWT string tokens', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      exp: fixedTime - 100,
    })
    const tokenString = stringifyToken(token)

    await expect(verifyToken(tokenString, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token expired',
    )
  })
})
