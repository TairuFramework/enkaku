import { randomIdentity } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import {
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  exportGroupInfo,
  inspectGroupInfo,
  joinGroupExternal,
  processWelcome,
} from '../src/group.js'

describe('inspectGroupInfo', () => {
  test('round-trips epoch and treeHash matching the source handle', async () => {
    const alice = randomIdentity()
    const { group } = await createGroup(alice, 'inspect-rt')

    const { groupInfo } = await exportGroupInfo({ group })
    const result = inspectGroupInfo(groupInfo)

    expect(result.epoch).toBe(group.epoch)
    expect(result.treeHash).toEqual(group.treeHash)
    expect(result.treeHash).toBeInstanceOf(Uint8Array)
  })

  test('epoch and treeHash both change when the tree advances', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'inspect-advance')
    const before = inspectGroupInfo((await exportGroupInfo({ group: aliceGroup })).groupInfo)

    // Add Bob → new epoch, new tree.
    const bobKP = await createKeyPackageBundle(bob)
    const { newGroup: aliceAfterBob } = await commitInvite(aliceGroup, bobKP.publicPackage)
    const after = inspectGroupInfo((await exportGroupInfo({ group: aliceAfterBob })).groupInfo)

    expect(after.epoch).toBe(before.epoch + 1n)
    expect(after.treeHash).not.toEqual(before.treeHash)
  })

  test('throws on malformed bytes', () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    expect(() => inspectGroupInfo(garbage)).toThrow()
  })

  test('throws on wrong wireformat (non-GroupInfo MLS message)', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'inspect-wf')
    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: aliceAfterBob } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )
    const { credential: bobCred } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKP,
      ratchetTree: aliceAfterBob.state.ratchetTree,
    })

    // joinGroupExternal returns a framed PUBLIC message (wireformat
    // mls_public_message) — a valid MLSMessage that is not a GroupInfo.
    const { groupInfo } = await exportGroupInfo({ group: aliceAfterBob })
    const { commitMessage } = await joinGroupExternal({
      identity: bob,
      groupInfo,
      credential: bobCred,
      resync: true,
    })

    expect(() => inspectGroupInfo(commitMessage)).toThrow(/expected wireformat mls_group_info/)
  })
})
