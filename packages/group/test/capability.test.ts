import { randomIdentity, stringifyToken } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import {
  createGroupCapability,
  delegateGroupMembership,
  validateGroupCapability,
} from '../src/capability.js'

describe('group capabilities', () => {
  test('creates a root admin capability', async () => {
    const alice = randomIdentity()
    const token = await createGroupCapability(alice, 'test-group')

    expect(token.payload.iss).toBe(alice.id)
    expect(token.payload.sub).toBe(alice.id)
    expect(token.payload.aud).toBe(alice.id)
    expect(token.payload.act).toBe('*')
    expect(token.payload.res).toEqual(['group/test-group/*'])
  })

  test('delegates member permission', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const memberCap = await delegateGroupMembership(alice, 'test-group', bob.id, 'member', {
      parentCapability: rootCapStr,
    })

    expect(memberCap.payload.iss).toBe(alice.id)
    expect(memberCap.payload.sub).toBe(alice.id)
    expect(memberCap.payload.aud).toBe(bob.id)
    expect(memberCap.payload.act).toEqual(['member'])
    expect(memberCap.payload.res).toEqual(['group/test-group/*'])
  })

  test('delegates with expiration', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const futureTime = Math.floor(Date.now() / 1000) + 3600
    const memberCap = await delegateGroupMembership(alice, 'test-group', bob.id, 'member', {
      parentCapability: rootCapStr,
      expiration: futureTime,
    })

    expect(memberCap.payload.exp).toBe(futureTime)
  })

  test('validates a root capability', async () => {
    const alice = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const validated = await validateGroupCapability(rootCapStr, 'test-group')
    expect(validated.payload.sub).toBe(alice.id)
  })

  test('validates a delegated capability with chain', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const rootCap = await createGroupCapability(alice, 'test-group')
    const rootCapStr = stringifyToken(rootCap)

    const memberCap = await delegateGroupMembership(alice, 'test-group', bob.id, 'member', {
      parentCapability: rootCapStr,
    })
    const memberCapStr = stringifyToken(memberCap)

    const validated = await validateGroupCapability(memberCapStr, 'test-group', [rootCapStr])
    expect(validated.payload.sub).toBe(alice.id)
    expect(validated.payload.aud).toBe(bob.id)
  })

  test('rejects capability for wrong group', async () => {
    const alice = randomIdentity()
    const rootCap = await createGroupCapability(alice, 'group-a')
    const rootCapStr = stringifyToken(rootCap)

    await expect(validateGroupCapability(rootCapStr, 'group-b')).rejects.toThrow(
      'does not grant access to group group-b',
    )
  })

  test('rejects capability from non-owner without chain', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    // Bob signs a capability claiming to be for alice's group but bob is not alice
    // so iss !== sub — delegation chain is required
    const fakeCap = await bob.signToken({
      sub: alice.id,
      aud: bob.id,
      act: ['member'],
      res: ['group/test-group/*'],
    })
    const fakeCapStr = stringifyToken(fakeCap)

    await expect(validateGroupCapability(fakeCapStr, 'test-group')).rejects.toThrow(
      'delegation chain required',
    )
  })
})
