import { getPublicKeyAsync } from '@noble/ed25519'
import { equals } from 'uint8arrays'

import { randomSigner } from '../src/principal.js'
import {
  type VerifiedToken,
  createSignedToken,
  createUnsignedToken,
  isSignedToken,
  isUnsignedToken,
  isVerifiedToken,
  signToken,
  stringifyToken,
  verifyToken,
} from '../src/token.js'

test('create a signed token and verify it', async () => {
  const signer = await randomSigner()
  const token = await createSignedToken(signer, { test: true })
  expect(isSignedToken(token)).toBe(true)
  expect(token.payload.iss).toBe(signer.did)
  const verified = await verifyToken(token)
  expect(isVerifiedToken(verified)).toBe(true)
  const publicKey = await getPublicKeyAsync(signer.privateKey)
  expect(equals((verified as VerifiedToken<{ test: true }>).verifiedPublicKey, publicKey)).toBe(
    true,
  )
})

test('create an unsigned token, sign and stringify it', async () => {
  const unsigned = createUnsignedToken({ test: true })
  expect(isUnsignedToken(unsigned)).toBe(true)
  const signer = await randomSigner()
  const signed = await signToken(signer, unsigned)
  expect(isSignedToken(signed)).toBe(true)
  const stringified = stringifyToken(signed)
  const verified = await verifyToken(stringified)
  expect(isVerifiedToken(verified)).toBe(true)
})
