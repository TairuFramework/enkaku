import { randomIdentity } from '@enkaku/token'
import { describe, expect, test } from 'vitest'

import {
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  processWelcome,
  removeMember,
} from '../src/group.js'

describe('GroupHandle lifecycle', () => {
  test('creates a group with single member', async () => {
    const alice = randomIdentity()
    const { group, credential } = await createGroup(alice, 'test-group-1')

    expect(group.groupID).toBe('test-group-1')
    expect(group.epoch).toBe(0n)
    expect(group.memberCount).toBe(1)
    expect(credential.did).toBe(alice.id)
    expect(credential.permission).toBe('admin')
    expect(credential.groupID).toBe('test-group-1')
  })

  test('invites and adds a member', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'invite-group')

    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    expect(invite.groupID).toBe('invite-group')
    expect(invite.permission).toBe('member')
    expect(invite.inviterDID).toBe(alice.id)

    const bobKeyBundle = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: updatedAliceGroup } = await commitInvite(
      aliceGroup,
      bobKeyBundle.publicPackage,
    )

    expect(updatedAliceGroup.epoch).toBe(1n)
    expect(updatedAliceGroup.memberCount).toBe(2)
    expect(welcomeMessage).toBeDefined()

    const { group: bobGroup, credential: bobCred } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKeyBundle,
      ratchetTree: updatedAliceGroup.state.ratchetTree,
    })

    expect(bobGroup.epoch).toBe(1n)
    expect(bobGroup.memberCount).toBe(2)
    expect(bobCred.did).toBe(bob.id)
    expect(bobCred.permission).toBe('member')
  })

  test('encrypts and decrypts messages between members', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'msg-group')
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKeyBundle = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: updatedAliceGroup } = await commitInvite(
      aliceGroup,
      bobKeyBundle.publicPackage,
    )
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKeyBundle,
      ratchetTree: updatedAliceGroup.state.ratchetTree,
    })

    // Alice sends to Bob
    const { message } = await updatedAliceGroup.encrypt(new TextEncoder().encode('hello bob'))
    const decrypted = await bobGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('hello bob')

    // Bob sends to Alice
    const { message: replyMsg } = await bobGroup.encrypt(new TextEncoder().encode('hello alice'))
    const decryptedReply = await updatedAliceGroup.decrypt(replyMsg)
    expect(new TextDecoder().decode(decryptedReply)).toBe('hello alice')
  })

  test('removes a member with forward secrecy', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'remove-group')
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKeyBundle = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: groupWithBob } = await commitInvite(
      aliceGroup,
      bobKeyBundle.publicPackage,
    )
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKeyBundle,
      ratchetTree: groupWithBob.state.ratchetTree,
    })

    const { newGroup: groupAfterRemoval } = await removeMember(groupWithBob, 1)
    expect(groupAfterRemoval.epoch).toBe(2n)
    expect(groupAfterRemoval.memberCount).toBe(1)

    const { message: secretMsg } = await groupAfterRemoval.encrypt(
      new TextEncoder().encode('secret'),
    )
    await expect(bobGroup.decrypt(secretMsg)).rejects.toThrow()
  })

  test('add device (self-invite)', async () => {
    const alice = randomIdentity()
    const aliceDevice2 = randomIdentity()

    const { group } = await createGroup(alice, 'alice-devices')
    const { invite } = await createInvite({
      group,
      identity: alice,
      recipientDID: aliceDevice2.id,
      permission: 'admin',
    })
    const device2KeyBundle = await createKeyPackageBundle(aliceDevice2)
    const { welcomeMessage, newGroup: updatedGroup } = await commitInvite(
      group,
      device2KeyBundle.publicPackage,
    )

    const { group: device2Group } = await processWelcome({
      identity: aliceDevice2,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: device2KeyBundle,
      ratchetTree: updatedGroup.state.ratchetTree,
    })

    const { message } = await updatedGroup.encrypt(new TextEncoder().encode('sync data'))
    const data = await device2Group.decrypt(message)
    expect(new TextDecoder().decode(data)).toBe('sync data')
  })

  test('three-member group with fan-out', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const charlie = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, '3-member')

    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage: bobWelcome, newGroup: groupWithBob } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )
    await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: bobWelcome,
      keyPackageBundle: bobKP,
      ratchetTree: groupWithBob.state.ratchetTree,
    })

    const { invite: charlieInvite } = await createInvite({
      group: groupWithBob,
      identity: alice,
      recipientDID: charlie.id,
      permission: 'member',
    })
    const charlieKP = await createKeyPackageBundle(charlie)
    const { welcomeMessage: charlieWelcome, newGroup: groupWith3 } = await commitInvite(
      groupWithBob,
      charlieKP.publicPackage,
    )
    const { group: charlieGroup } = await processWelcome({
      identity: charlie,
      invite: charlieInvite,
      welcome: charlieWelcome,
      keyPackageBundle: charlieKP,
      ratchetTree: groupWith3.state.ratchetTree,
    })

    expect(groupWith3.memberCount).toBe(3)
    expect(charlieGroup.memberCount).toBe(3)
    expect(groupWith3.epoch).toBe(2n)

    const { message } = await groupWith3.encrypt(new TextEncoder().encode('hello everyone'))
    const decrypted = await charlieGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('hello everyone')
  })

  test('multi-epoch message exchange', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'epoch-test')
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: epoch1Group } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKP,
      ratchetTree: epoch1Group.state.ratchetTree,
    })

    const { message: msg1 } = await epoch1Group.encrypt(new TextEncoder().encode('epoch-1-msg'))
    expect(new TextDecoder().decode(await bobGroup.decrypt(msg1))).toBe('epoch-1-msg')

    const charlie = randomIdentity()
    const charlieKP = await createKeyPackageBundle(charlie)
    const { newGroup: epoch2Group } = await commitInvite(epoch1Group, charlieKP.publicPackage)
    expect(epoch2Group.epoch).toBe(2n)

    const { message: msg2 } = await epoch2Group.encrypt(new TextEncoder().encode('epoch-2-msg'))
    await expect(bobGroup.decrypt(msg2)).rejects.toThrow()
  })

  test('processWelcome throws on invite with empty capability chain', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'empty-chain')
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage } = await commitInvite(aliceGroup, bobKP.publicPackage)

    const badInvite = {
      groupID: 'empty-chain',
      capabilityToken: 'invalid',
      capabilityChain: [],
      permission: 'member' as const,
      inviterDID: alice.id,
    }

    await expect(
      processWelcome({
        identity: bob,
        invite: badInvite,
        welcome: welcomeMessage,
        keyPackageBundle: bobKP,
        ratchetTree: aliceGroup.state.ratchetTree,
      }),
    ).rejects.toThrow()
  })
})
