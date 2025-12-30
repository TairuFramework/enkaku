import { ed25519 } from '@noble/curves/ed25519.js'
import { equals } from 'uint8arrays'
import { expect, test } from 'vitest'

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
