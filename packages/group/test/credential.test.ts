import {
  createIdentity,
  createInMemoryDIDCache,
  randomIdentity,
  stringifyToken,
} from '@enkaku/token'
import { describe, expect, it, test } from 'vitest'

import { createGroupCapability, delegateGroupMembership } from '../src/capability.js'
import {
  credentialToMLSIdentity,
  extractPermission,
  type MemberCredential,
  mlsIdentityToSerializedCredential,
  populateCacheFromCredential,
  type SerializedCredential,
} from '../src/credential.js'

function makeSignedTokenWithAct(act: Array<string>) {
  return {
    header: { typ: 'JWT' as const, alg: 'EdDSA' as const },
    payload: { iss: 'did:key:z...', sub: 'did:key:z...', aud: 'did:key:z...', act, res: ['*'] },
    signature: 'fake',
    data: 'fake',
  }
}

describe('credential', () => {
  test('round-trips credential through MLS identity', async () => {
    const alice = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const credential: MemberCredential = {
      did: alice.id,
      capabilityChain: [rootCapStr],
      capability: rootCap,
      permission: 'admin',
      groupID: 'test-group',
    }

    const identity = credentialToMLSIdentity(credential)
    expect(identity).toBeInstanceOf(Uint8Array)

    const deserialized = mlsIdentityToSerializedCredential(identity)
    expect(deserialized.did).toBe(alice.id)
    expect(deserialized.groupID).toBe('test-group')
    expect(deserialized.capabilityChain).toEqual([rootCapStr])
  })

  test('extracts admin permission', async () => {
    const alice = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'test-group')
    expect(extractPermission(rootCap)).toBe('admin')
  })

  test('extracts member permission', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const memberCap = await delegateGroupMembership({
      identity: alice,
      groupID: 'test-group',
      recipientDID: bob.id,
      permission: 'member',
      parentCapability: rootCapStr,
    })
    expect(extractPermission(memberCap)).toBe('member')
  })

  test('extracts read permission', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const readCap = await delegateGroupMembership({
      identity: alice,
      groupID: 'test-group',
      recipientDID: bob.id,
      permission: 'read',
      parentCapability: rootCapStr,
    })
    expect(extractPermission(readCap)).toBe('read')
  })

  test('extractPermission throws for unrecognized action', () => {
    const token = makeSignedTokenWithAct(['write'])
    expect(() => extractPermission(token)).toThrow('no recognized permission level')
  })

  test('mlsIdentityToSerializedCredential throws on non-JSON input', () => {
    const badBytes = new TextEncoder().encode('not json')
    expect(() => mlsIdentityToSerializedCredential(badBytes)).toThrow()
  })

  test('mlsIdentityToSerializedCredential throws when required fields are missing', () => {
    const incomplete = new TextEncoder().encode(JSON.stringify({ did: 'test' }))
    expect(() => mlsIdentityToSerializedCredential(incomplete)).toThrow(
      'malformed serialized credential',
    )
  })

  test('mlsIdentityToSerializedCredential throws when capabilityChain is not an array', () => {
    const bad = new TextEncoder().encode(
      JSON.stringify({ did: 'test', groupID: 'g1', capabilityChain: 'not-array' }),
    )
    expect(() => mlsIdentityToSerializedCredential(bad)).toThrow('malformed serialized credential')
  })
})

describe('SerializedCredential.longForm', () => {
  it('credentialToMLSIdentity embeds longForm when peer4 identity passes it', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = {
      did: identity.did,
      capabilityChain: ['cap-token'],
      capability: { payload: { act: 'read', res: 'foo' } } as never,
      permission: 'read' as const,
      groupID: 'group-1',
    }
    const bytes = credentialToMLSIdentity(credential, { longForm: identity.longForm })
    const parsed = mlsIdentityToSerializedCredential(bytes)
    expect(parsed.longForm).toBe(identity.longForm)
    expect(parsed.did).toBe(identity.did)
  })

  it('credentialToMLSIdentity omits longForm for did:key identities', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const credential = {
      did: identity.did,
      capabilityChain: [],
      capability: { payload: { act: 'read', res: 'foo' } } as never,
      permission: 'read' as const,
      groupID: 'group-1',
    }
    // Even when longForm option is provided, did:key identities don't get it embedded.
    const bytes = credentialToMLSIdentity(credential, { longForm: identity.longForm })
    const parsed = mlsIdentityToSerializedCredential(bytes)
    expect(parsed.longForm).toBeUndefined()
  })

  it('mlsIdentityToSerializedCredential rejects malformed longForm type', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        did: 'did:peer:4zXyz',
        groupID: 'g',
        capabilityChain: [],
        longForm: 42, // wrong type
      }),
    )
    expect(() => mlsIdentityToSerializedCredential(bytes)).toThrow(/longForm/i)
  })

  it('populateCacheFromCredential writes the doc to the cache when longForm matches did', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const serialized: SerializedCredential = {
      did: identity.did,
      groupID: 'g',
      capabilityChain: [],
      longForm: identity.longForm,
    }
    const cache = createInMemoryDIDCache()
    await populateCacheFromCredential(serialized, cache)
    expect(await cache.get(identity.did)).toEqual(identity.doc)
  })

  it('populateCacheFromCredential is a no-op when longForm is absent', async () => {
    const cache = createInMemoryDIDCache()
    const serialized: SerializedCredential = {
      did: 'did:key:z6MkSample',
      groupID: 'g',
      capabilityChain: [],
    }
    await expect(populateCacheFromCredential(serialized, cache)).resolves.toBeUndefined()
  })

  it('populateCacheFromCredential rejects when longForm hash does not match did', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const serialized: SerializedCredential = {
      did: alice.did,
      groupID: 'g',
      capabilityChain: [],
      longForm: bob.longForm, // mismatched
    }
    const cache = createInMemoryDIDCache()
    await expect(populateCacheFromCredential(serialized, cache)).rejects.toThrow(/does not match/i)
  })
})
