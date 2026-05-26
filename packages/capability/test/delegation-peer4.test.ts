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
    // Alice (root) delegates `foo` over resource alice.did to Bob, signing with long-form iss.
    const aToB = await alice.sign(
      { sub: alice.did, aud: bob.did, act: 'foo', res: alice.did },
      { embedLongForm: true },
    )
    expect(aToB.payload.iss).toBe(alice.longForm)
    // Bob's request: sub = alice (the authority root), iss = bob (short form), cap = [aToB].
    const leaf = await bob.sign(
      { sub: alice.did, prc: 'foo', cap: [stringifyToken(aToB)] },
      { embedLongForm: false },
    )
    expect(leaf.payload.iss).toBe(bob.did)
    const cache = createInMemoryDIDCache()
    const options: DelegationChainOptions = { cache }
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload, options),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.did)).toBeDefined()
  })

  it('2b: root short-form (pre-cached), leaf long-form, single hop verifies', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const aToB = await alice.sign(
      { sub: alice.did, aud: bob.did, act: 'foo', res: alice.did },
      { embedLongForm: false },
    )
    expect(aToB.payload.iss).toBe(alice.did)
    const cache = createInMemoryDIDCache()
    await cache.set(alice.did, alice.doc)
    const leaf = await bob.sign(
      { sub: alice.did, prc: 'foo', cap: [stringifyToken(aToB)] },
      { embedLongForm: true },
    )
    expect(leaf.payload.iss).toBe(bob.longForm)
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload, { cache }),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.did)).toBeDefined()
  })

  it('2c: 3-hop chain with mixed forms verifies and populates cache transitively', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const carol = await makePeer4()
    // Hop 1: alice → bob (long form).
    const aToB = await alice.sign(
      { sub: alice.did, aud: bob.did, act: 'foo', res: alice.did },
      { embedLongForm: true },
    )
    // Hop 2: bob → carol (long form, first contact for bob with carol).
    const bToC = await bob.sign(
      { sub: alice.did, aud: carol.did, act: 'foo', res: alice.did },
      { embedLongForm: true },
    )
    // Leaf request from carol — FLAT chain: leaf-most first (bToC), then root-most (aToB).
    const leaf = await carol.sign(
      {
        sub: alice.did,
        prc: 'foo',
        cap: [stringifyToken(bToC), stringifyToken(aToB)],
      },
      { embedLongForm: true },
    )
    const cache = createInMemoryDIDCache()
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload, { cache }),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.did)).toBeDefined()
    expect(await cache.get(bob.did)).toBeDefined()
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
    const aToB = await alice.sign({
      sub: alice.did,
      aud: bob.did,
      act: 'foo',
      res: alice.did,
    })
    const leaf = await bob.sign({
      sub: alice.did,
      prc: 'foo',
      cap: [stringifyToken(aToB)],
    })
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload),
    ).resolves.toBeUndefined()
  })

  it('2f: capability token with iss=long, sub=short of same peer4 identity short-circuits self-issued', async () => {
    const alice = await makePeer4()
    // Capability token where alice is both issuer and subject — should short-circuit.
    const cap = await alice.sign(
      { sub: alice.did, act: 'foo', res: alice.did },
      { embedLongForm: true },
    )
    expect(cap.payload.iss).toBe(alice.longForm)
    expect(cap.payload.sub).toBe(alice.did)
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, cap.payload),
    ).resolves.toBeUndefined()
  })

  it('2f: payload with iss=alice, sub=bob (different identities) does NOT short-circuit', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const payload = {
      iss: alice.did,
      sub: bob.did,
    } as unknown as Parameters<typeof checkCapability>[1]
    await expect(checkCapability({ act: 'foo', res: alice.did }, payload)).rejects.toThrow(
      /no capability|Invalid payload/i,
    )
  })
})
