import { randomIdentity, stringifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import { createGroupCapability, delegateGroupMembership } from '../src/capability.js'
import {
  credentialToMLSIdentity,
  extractPermission,
  type MemberCredential,
  mlsIdentityToSerializedCredential,
} from '../src/credential.js'

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

    const memberCap = await delegateGroupMembership(alice, 'test-group', bob.id, 'member', {
      parentCapability: rootCapStr,
    })
    expect(extractPermission(memberCap)).toBe('member')
  })

  test('extracts read permission', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const readCap = await delegateGroupMembership(alice, 'test-group', bob.id, 'read', {
      parentCapability: rootCapStr,
    })
    expect(extractPermission(readCap)).toBe('read')
  })
})
