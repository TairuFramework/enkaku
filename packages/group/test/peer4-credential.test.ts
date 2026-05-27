import {
  createIdentity,
  createInMemoryDIDCache,
  type MultiKeyIdentity,
  stringifyToken,
} from '@enkaku/token'
import { describe, expect, it } from 'vitest'

import { validateGroupCapability } from '../src/capability.js'
import { populateCacheFromCredential, type SerializedCredential } from '../src/credential.js'

async function makePeer4(): Promise<MultiKeyIdentity> {
  return await createIdentity({
    keys: [{ purpose: 'sig', alg: 'EdDSA' }],
    didMethod: 'peer:4',
  })
}

describe('Gate 4 (minimal) — peer4 group capability + credential', () => {
  it('validateGroupCapability accepts a peer4-signed root capability via long-form iss', async () => {
    const alice = await makePeer4()
    const groupID = 'group-1'
    // Root group capability: alice self-signs, long-form iss (first contact via embedLongForm).
    const rootCap = await alice.signToken(
      {
        sub: alice.id,
        aud: alice.id,
        act: '*',
        res: [`group/${groupID}/*`],
      },
      { embedLongForm: true },
    )
    expect(rootCap.payload.iss).toBe(alice.longForm)
    const cache = createInMemoryDIDCache()
    const token = await validateGroupCapability({
      tokenData: stringifyToken(rootCap),
      groupID,
      options: { cache },
    })
    expect(token.payload.act).toEqual('*')
    expect(await cache.get(alice.id)).toEqual(alice.doc)
  })

  it('validateGroupCapability with a peer4 delegation chain populates cache transitively', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const groupID = 'group-2'
    const rootCap = await alice.signToken(
      {
        sub: alice.id,
        aud: alice.id,
        act: '*',
        res: [`group/${groupID}/*`],
      },
      { embedLongForm: true },
    )
    const memberCap = await alice.signToken(
      {
        sub: alice.id,
        aud: bob.id,
        act: ['member'],
        res: [`group/${groupID}/*`],
      },
      { embedLongForm: true },
    )
    const cache = createInMemoryDIDCache()
    const token = await validateGroupCapability({
      tokenData: stringifyToken(memberCap),
      groupID,
      delegationChain: [stringifyToken(rootCap)],
      options: { cache },
    })
    expect(token.payload.aud).toBe(bob.id)
    expect(await cache.get(alice.id)).toBeDefined()
  })

  it('validateGroupCapability rejects when peer4 short-form is unresolvable', async () => {
    const alice = await makePeer4()
    const groupID = 'group-3'
    // Sign with short-form iss only; no cache, no resolver.
    const rootCap = await alice.signToken(
      {
        sub: alice.id,
        aud: alice.id,
        act: '*',
        res: [`group/${groupID}/*`],
      },
      { embedLongForm: false },
    )
    expect(rootCap.payload.iss).toBe(alice.id)
    await expect(
      validateGroupCapability({
        tokenData: stringifyToken(rootCap),
        groupID,
      }),
    ).rejects.toThrow(/Unknown DID/)
  })

  it('validateGroupCapability with cache pre-populated resolves short-form iss', async () => {
    const alice = await makePeer4()
    const groupID = 'group-4'
    const rootCap = await alice.signToken(
      {
        sub: alice.id,
        aud: alice.id,
        act: '*',
        res: [`group/${groupID}/*`],
      },
      { embedLongForm: false },
    )
    const cache = createInMemoryDIDCache()
    await cache.set(alice.id, alice.doc)
    const token = await validateGroupCapability({
      tokenData: stringifyToken(rootCap),
      groupID,
      options: { cache },
    })
    expect(token.payload.iss).toBe(alice.id)
  })

  it('populateCacheFromCredential writes to a cache obtained from a GroupHandle', async () => {
    const alice = await makePeer4()
    const serialized: SerializedCredential = {
      did: alice.id,
      groupID: 'g',
      capabilityChain: [],
      longForm: alice.longForm,
    }
    const cache = createInMemoryDIDCache()
    await populateCacheFromCredential(serialized, cache)
    expect(await cache.get(alice.id)).toEqual(alice.doc)
  })

  it('did:key group capability still works (regression)', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const groupID = 'group-5'
    const rootCap = await alice.signToken({
      sub: alice.id,
      aud: alice.id,
      act: '*',
      res: [`group/${groupID}/*`],
    })
    const token = await validateGroupCapability({
      tokenData: stringifyToken(rootCap),
      groupID,
    })
    expect(token.payload.iss).toBe(alice.id)
  })
})
