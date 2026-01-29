import { ed25519 } from '@noble/curves/ed25519.js'
import { equals } from 'uint8arrays'
import { describe, expect, test } from 'vitest'

import { randomTokenSigner } from '../src/signer.js'
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
  const signer = randomTokenSigner()
  const token = await signer.createToken({ test: true })
  expect(isSignedToken(token)).toBe(true)
  expect(token.payload.iss).toBe(signer.id)
  const verified = await verifyToken(token)
  expect(isVerifiedToken(verified)).toBe(true)
  const publicKey = ed25519.getPublicKey(signer.privateKey)
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
  const signer = randomTokenSigner()
  const signed = await signToken(signer, unsigned)
  expect(isSignedToken(signed)).toBe(true)
  const stringified = stringifyToken(signed)
  const verified = await verifyToken(stringified)
  expect(isVerifiedToken(verified)).toBe(true)
})

describe('verifyToken with time validation', () => {
  const fixedTime = 1700000000

  test('rejects expired signed token', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      exp: fixedTime - 100,
    })

    await expect(verifyToken(token, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token expired',
    )
  })

  test('rejects token not yet valid (nbf in future)', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      nbf: fixedTime + 100,
    })

    await expect(verifyToken(token, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token not yet valid',
    )
  })

  test('accepts token within valid time window', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      nbf: fixedTime - 100,
      exp: fixedTime + 100,
    })

    const result = await verifyToken(token, undefined, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('accepts token without time claims', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({ test: true })

    const result = await verifyToken(token, undefined, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('respects clockTolerance option', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
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
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      exp: fixedTime - 100,
    })
    const tokenString = stringifyToken(token)

    await expect(verifyToken(tokenString, undefined, { atTime: fixedTime })).rejects.toThrow(
      'Token expired',
    )
  })
})
