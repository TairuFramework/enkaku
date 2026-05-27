import {
  createIdentity,
  createInMemoryDIDCache,
  type MultiKeyIdentity,
  stringifyToken,
} from '@enkaku/token'
import { describe, expect, it } from 'vitest'

import { checkCapability, type DelegationChainOptions } from '../src/index.js'

async function makePeer4(): Promise<MultiKeyIdentity> {
  return await createIdentity({
    keys: [{ purpose: 'sig', alg: 'EdDSA' }],
    didMethod: 'peer:4',
  })
}

describe('Gate 2 — peer4 delegation matrix', () => {
  it('2a: root long-form, leaf short-form, single hop verifies', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    // Alice (root) delegates `foo` over resource alice.id to Bob, signing with long-form iss.
    const aToB = await alice.signToken(
      { sub: alice.id, aud: bob.id, act: 'foo', res: alice.id },
      { embedLongForm: true },
    )
    expect(aToB.payload.iss).toBe(alice.longForm)
    // Bob's request: sub = alice (the authority root), iss = bob (short form), cap = [aToB].
    const leaf = await bob.signToken(
      { sub: alice.id, prc: 'foo', cap: [stringifyToken(aToB)] },
      { embedLongForm: false },
    )
    expect(leaf.payload.iss).toBe(bob.id)
    const cache = createInMemoryDIDCache()
    const options: DelegationChainOptions = { cache }
    await expect(
      checkCapability({ act: 'foo', res: alice.id }, leaf.payload, options),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.id)).toBeDefined()
  })

  it('2b: root short-form (pre-cached), leaf long-form, single hop verifies', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const aToB = await alice.signToken(
      { sub: alice.id, aud: bob.id, act: 'foo', res: alice.id },
      { embedLongForm: false },
    )
    expect(aToB.payload.iss).toBe(alice.id)
    const cache = createInMemoryDIDCache()
    await cache.set(alice.id, alice.doc)
    const leaf = await bob.signToken(
      { sub: alice.id, prc: 'foo', cap: [stringifyToken(aToB)] },
      { embedLongForm: true },
    )
    expect(leaf.payload.iss).toBe(bob.longForm)
    await expect(
      checkCapability({ act: 'foo', res: alice.id }, leaf.payload, { cache }),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.id)).toBeDefined()
  })

  it('2c: 3-hop chain with mixed forms verifies and populates cache transitively', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const carol = await makePeer4()
    // Hop 1: alice → bob (long form).
    const aToB = await alice.signToken(
      { sub: alice.id, aud: bob.id, act: 'foo', res: alice.id },
      { embedLongForm: true },
    )
    // Hop 2: bob → carol (long form, first contact for bob with carol).
    const bToC = await bob.signToken(
      { sub: alice.id, aud: carol.id, act: 'foo', res: alice.id },
      { embedLongForm: true },
    )
    // Leaf request from carol — FLAT chain: leaf-most first (bToC), then root-most (aToB).
    const leaf = await carol.signToken(
      {
        sub: alice.id,
        prc: 'foo',
        cap: [stringifyToken(bToC), stringifyToken(aToB)],
      },
      { embedLongForm: true },
    )
    const cache = createInMemoryDIDCache()
    await expect(
      checkCapability({ act: 'foo', res: alice.id }, leaf.payload, { cache }),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.id)).toBeDefined()
    expect(await cache.get(bob.id)).toBeDefined()
  })

  it('2e: did:key delegation still works (regression)', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const aToB = await alice.signToken({
      sub: alice.id,
      aud: bob.id,
      act: 'foo',
      res: alice.id,
    })
    const leaf = await bob.signToken({
      sub: alice.id,
      prc: 'foo',
      cap: [stringifyToken(aToB)],
    })
    await expect(
      checkCapability({ act: 'foo', res: alice.id }, leaf.payload),
    ).resolves.toBeUndefined()
  })

  it('2f: capability token with iss=long, sub=short of same peer4 identity short-circuits self-issued', async () => {
    const alice = await makePeer4()
    // Capability token where alice is both issuer and subject — should short-circuit.
    const cap = await alice.signToken(
      { sub: alice.id, act: 'foo', res: alice.id },
      { embedLongForm: true },
    )
    expect(cap.payload.iss).toBe(alice.longForm)
    expect(cap.payload.sub).toBe(alice.id)
    await expect(
      checkCapability({ act: 'foo', res: alice.id }, cap.payload),
    ).resolves.toBeUndefined()
  })

  it('2f: payload with iss=alice, sub=bob (different identities) does NOT short-circuit', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const payload = {
      iss: alice.id,
      sub: bob.id,
    } as unknown as Parameters<typeof checkCapability>[1]
    await expect(checkCapability({ act: 'foo', res: alice.id }, payload)).rejects.toThrow(
      /no capability|Invalid payload/i,
    )
  })
})
