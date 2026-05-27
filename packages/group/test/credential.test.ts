import {
  createIdentity,
  createInMemoryDIDCache,
  randomIdentity,
  stringifyToken,
} from '@enkaku/token'
import { defaultCredentialTypes } from 'ts-mls'
import { describe, expect, it, test } from 'vitest'

import { createGroupCapability, delegateGroupMembership } from '../src/capability.js'
import {
  extractPermission,
  type MemberCredential,
  parseMLSCredentialIdentity,
  populateCacheFromCredential,
} from '../src/credential.js'
import { makeMLSCredential } from '../src/group.js'

function makeSignedTokenWithAct(act: Array<string>) {
  return {
    header: { typ: 'JWT' as const, alg: 'EdDSA' as const },
    payload: { iss: 'did:key:z...', sub: 'did:key:z...', aud: 'did:key:z...', act, res: ['*'] },
    signature: 'fake',
    data: 'fake',
  }
}

describe('parseMLSCredentialIdentity', () => {
  it('accepts a minimal did:key credential', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: 'did:key:z6MkABC' }))
    const parsed = parseMLSCredentialIdentity(bytes)
    expect(parsed).toEqual({ id: 'did:key:z6MkABC' })
  })

  it('accepts a peer4 credential carrying longForm', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ id: 'did:peer:4zABC', longForm: 'did:peer:4zABC:eyJ...' }),
    )
    const parsed = parseMLSCredentialIdentity(bytes)
    expect(parsed.id).toBe('did:peer:4zABC')
    expect(parsed.longForm).toBe('did:peer:4zABC:eyJ...')
  })

  it('rejects non-JSON input', () => {
    const bytes = new TextEncoder().encode('not-json')
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow()
  })

  it('rejects JSON missing the id field', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ longForm: 'x' }))
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow(/id/i)
  })

  it('rejects JSON where id is not a string', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: 42 }))
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow(/id/i)
  })

  it('rejects JSON where longForm is not a string', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: 'did:key:z', longForm: 42 }))
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow(/longForm/i)
  })
})

describe('credential', () => {
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
})

describe('populateCacheFromCredential', () => {
  it('writes the doc to the cache when longForm matches id', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    await populateCacheFromCredential({ id: identity.id, longForm: identity.longForm }, cache)
    expect(await cache.get(identity.id)).toEqual(identity.doc)
  })

  it('is a no-op when longForm is absent', async () => {
    const cache = createInMemoryDIDCache()
    await expect(
      populateCacheFromCredential({ id: 'did:key:z6MkSample' }, cache),
    ).resolves.toBeUndefined()
  })

  it('rejects when longForm hash does not match id', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    await expect(
      populateCacheFromCredential({ id: alice.id, longForm: bob.longForm }, cache),
    ).rejects.toThrow(/does not match/i)
  })
})

describe('makeMLSCredential', () => {
  it('emits JSON { id } for a did:key identity', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const credential = makeMLSCredential(identity)
    expect(credential.credentialType).toBe(defaultCredentialTypes.basic)
    const parsed = parseMLSCredentialIdentity((credential as { identity: Uint8Array }).identity)
    expect(parsed.id).toBe(identity.id)
    expect(parsed.longForm).toBeUndefined()
  })

  it('emits JSON { id, longForm } for a did:peer:4 identity', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    expect(credential.credentialType).toBe(defaultCredentialTypes.basic)
    const parsed = parseMLSCredentialIdentity((credential as { identity: Uint8Array }).identity)
    expect(parsed.id).toBe(identity.id)
    expect(parsed.longForm).toBe(identity.longForm)
  })

  it('throws when a peer4 identity has no longForm', () => {
    const fake = {
      id: 'did:peer:4zABC',
      publicKey: new Uint8Array(32),
      privateKey: new Uint8Array(32),
      signToken: async () => {
        throw new Error('not used')
      },
    } as unknown as Parameters<typeof makeMLSCredential>[0]
    expect(() => makeMLSCredential(fake)).toThrow(/longForm/i)
  })
})

// Ensure MemberCredential type uses `id` field
const _typeCheck: MemberCredential = {
  id: 'did:key:z...',
  capabilityChain: [],
  capability: { payload: { act: 'read', res: 'foo' } } as never,
  permission: 'read',
  groupID: 'group-1',
}
void _typeCheck
