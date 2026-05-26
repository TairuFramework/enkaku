import { b64uFromJSON } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'
import { equals } from 'uint8arrays'
import { describe, expect, it, test } from 'vitest'

import { createIdentity, randomIdentity } from '../src/identity.js'
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

    await expect(verifyToken(token, { atTime: fixedTime })).rejects.toThrow('Token expired')
  })

  test('rejects token not yet valid (nbf in future)', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      nbf: fixedTime + 100,
    })

    await expect(verifyToken(token, { atTime: fixedTime })).rejects.toThrow('Token not yet valid')
  })

  test('accepts token within valid time window', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      nbf: fixedTime - 100,
      exp: fixedTime + 100,
    })

    const result = await verifyToken(token, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('accepts token without time claims', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({ test: true })

    const result = await verifyToken(token, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('respects clockTolerance option', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      exp: fixedTime - 5,
    })

    await expect(verifyToken(token, { atTime: fixedTime })).rejects.toThrow('Token expired')

    const result = await verifyToken(token, { atTime: fixedTime, clockTolerance: 10 })
    expect(result.payload.test).toBe(true)
  })

  test('validates time claims for JWT string tokens', async () => {
    const identity = randomIdentity()
    const token = await identity.signToken({
      test: true,
      exp: fixedTime - 100,
    })
    const tokenString = stringifyToken(token)

    await expect(verifyToken(tokenString, { atTime: fixedTime })).rejects.toThrow('Token expired')
  })
})

test('verifyToken uses generic error for invalid header type', async () => {
  const identity = randomIdentity()
  const token = await identity.signToken({ test: true })
  const str = stringifyToken(token)
  const [, payload, sig] = str.split('.')
  const badHeader = b64uFromJSON({ typ: 'NOT_JWT', alg: 'EdDSA' })
  await expect(verifyToken(`${badHeader}.${payload}.${sig}`)).rejects.toThrow(
    'Invalid token header type',
  )
})

test('verifyToken uses generic error for unsupported algorithm', async () => {
  const identity = randomIdentity()
  const token = await identity.signToken({ test: true })
  const str = stringifyToken(token)
  const [, payload, sig] = str.split('.')
  const badHeader = b64uFromJSON({ typ: 'JWT', alg: 'RS256' })
  await expect(verifyToken(`${badHeader}.${payload}.${sig}`)).rejects.toThrow(
    'Unsupported signature algorithm',
  )
})

describe('verifyToken with cache', () => {
  it('populates cache when iss is peer4 long form and signature is valid', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const { createInMemoryDIDCache } = await import('../src/cache.js')
    const { encodePeer4 } = await import('../src/peer4.js')
    const cache = createInMemoryDIDCache()
    const { ed25519: ed } = await import('@noble/curves/ed25519.js')
    const { b64uFromJSON: b64uJSON, fromUTF: fUTF, toB64U: tb64u } = await import('@enkaku/codec')
    const key = identity.keys[0]
    const header = { typ: 'JWT' as const, alg: 'EdDSA' as const, kid: key.fragment }
    const payload = { iss: identity.longForm, sub: identity.did, aud: 'someone' }
    const data = `${b64uJSON(header)}.${b64uJSON(payload)}`
    const signature = tb64u(ed.sign(fUTF(data), key.privateKey))
    const token = { header, payload, signature, data }
    await verifyToken(token, { cache })
    const { shortForm } = encodePeer4(identity.doc)
    expect(await cache.get(shortForm)).toEqual(identity.doc)
  })

  it('does NOT populate cache when signature is invalid', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const { createInMemoryDIDCache } = await import('../src/cache.js')
    const { encodePeer4 } = await import('../src/peer4.js')
    const cache = createInMemoryDIDCache()
    const { ed25519: ed } = await import('@noble/curves/ed25519.js')
    const { b64uFromJSON: b64uJSON, fromUTF: fUTF, toB64U: tb64u } = await import('@enkaku/codec')
    const key = identity.keys[0]
    const header = { typ: 'JWT' as const, alg: 'EdDSA' as const, kid: key.fragment }
    const payload = { iss: identity.longForm, sub: identity.did, aud: 'someone' }
    const data = `${b64uJSON(header)}.${b64uJSON(payload)}`
    const goodSig = ed.sign(fUTF(data), key.privateKey)
    void goodSig
    const tamperedBytes = new Uint8Array(64)
    tamperedBytes[0] = 1
    const bad = { header, payload, signature: tb64u(tamperedBytes), data }
    await expect(verifyToken(bad, { cache })).rejects.toThrow(/Invalid signature/)
    const { shortForm } = encodePeer4(identity.doc)
    expect(await cache.get(shortForm)).toBeUndefined()
  })

  it('verifies short-form iss against pre-populated cache', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const { createInMemoryDIDCache } = await import('../src/cache.js')
    const { encodePeer4 } = await import('../src/peer4.js')
    const cache = createInMemoryDIDCache()
    const { shortForm } = encodePeer4(identity.doc)
    await cache.set(shortForm, identity.doc)
    const token = await identity.sign({ sub: identity.did, aud: 'someone' })
    await expect(verifyToken(token, { cache })).resolves.toBeDefined()
  })

  it('falls through to resolver on cache miss', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const { createInMemoryDIDCache } = await import('../src/cache.js')
    const { encodePeer4 } = await import('../src/peer4.js')
    const cache = createInMemoryDIDCache()
    const { shortForm } = encodePeer4(identity.doc)
    let resolverHits = 0
    const resolver = (did: string) => {
      resolverHits++
      return did === shortForm ? identity.doc : undefined
    }
    const token = await identity.sign({ sub: identity.did, aud: 'someone' })
    await verifyToken(token, { cache, resolver })
    expect(resolverHits).toBe(1)
    const token2 = await identity.sign({ sub: identity.did, aud: 'someone-else' })
    await verifyToken(token2, { cache, resolver })
    expect(resolverHits).toBe(1)
  })
})
