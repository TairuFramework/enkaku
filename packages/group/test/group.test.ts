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

    // Create invite for Bob
    const { invite } = await createInvite(aliceGroup, alice, bob.id, 'member')
    expect(invite.groupID).toBe('invite-group')
    expect(invite.permission).toBe('member')
    expect(invite.inviterDID).toBe(alice.id)

    // Bob generates a key package
    const bobKeyBundle = await createKeyPackageBundle(bob)

    // Alice commits the invite with Bob's key package
    const { welcomeMessage, newGroup: updatedAliceGroup } = await commitInvite(
      aliceGroup,
      bobKeyBundle.publicPackage,
    )

    expect(updatedAliceGroup.epoch).toBe(1n)
    expect(updatedAliceGroup.memberCount).toBe(2)
    expect(welcomeMessage).toBeDefined()

    // Bob processes the Welcome to join
    const { group: bobGroup, credential: bobCred } = await processWelcome(
      bob,
      invite,
      welcomeMessage,
      bobKeyBundle,
      updatedAliceGroup.state.ratchetTree,
    )

    expect(bobGroup.epoch).toBe(1n)
    expect(bobGroup.memberCount).toBe(2)
    expect(bobCred.did).toBe(bob.id)
    expect(bobCred.permission).toBe('member')
  })

  test('encrypts and decrypts messages between members', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    // Setup group
    const { group: aliceGroup } = await createGroup(alice, 'msg-group')
    const { invite } = await createInvite(aliceGroup, alice, bob.id, 'member')
    const bobKeyBundle = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: updatedAliceGroup } = await commitInvite(
      aliceGroup,
      bobKeyBundle.publicPackage,
    )
    const { group: bobGroup } = await processWelcome(
      bob,
      invite,
      welcomeMessage,
      bobKeyBundle,
      updatedAliceGroup.state.ratchetTree,
    )

    // Alice sends to Bob
    const plaintext = new TextEncoder().encode('hello bob')
    const { message } = await updatedAliceGroup.encrypt(plaintext)
    const decrypted = await bobGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('hello bob')

    // Bob sends to Alice
    const reply = new TextEncoder().encode('hello alice')
    const { message: replyMsg } = await bobGroup.encrypt(reply)
    const decryptedReply = await updatedAliceGroup.decrypt(replyMsg)
    expect(new TextDecoder().decode(decryptedReply)).toBe('hello alice')
  })

  test('removes a member with forward secrecy', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    // Setup
    const { group: aliceGroup } = await createGroup(alice, 'remove-group')
    const { invite } = await createInvite(aliceGroup, alice, bob.id, 'member')
    const bobKeyBundle = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: groupWithBob } = await commitInvite(
      aliceGroup,
      bobKeyBundle.publicPackage,
    )
    const { group: bobGroup } = await processWelcome(
      bob,
      invite,
      welcomeMessage,
      bobKeyBundle,
      groupWithBob.state.ratchetTree,
    )

    // Remove Bob (leaf index 1)
    const { newGroup: groupAfterRemoval } = await removeMember(groupWithBob, 1)
    expect(groupAfterRemoval.epoch).toBe(2n)
    expect(groupAfterRemoval.memberCount).toBe(1)

    // Post-removal message — Bob cannot decrypt
    const { message: secretMsg } = await groupAfterRemoval.encrypt(
      new TextEncoder().encode('secret'),
    )
    await expect(bobGroup.decrypt(secretMsg)).rejects.toThrow()
  })

  test('add device (self-invite)', async () => {
    const alice = randomIdentity()
    const aliceDevice2 = randomIdentity()

    // Create personal device group
    const { group } = await createGroup(alice, 'alice-devices')

    // Self-invite: alice invites "another device"
    // In a real scenario, both devices share the same user DID but have different device keys
    const { invite } = await createInvite(group, alice, aliceDevice2.id, 'admin')
    const device2KeyBundle = await createKeyPackageBundle(aliceDevice2)
    const { welcomeMessage, newGroup: updatedGroup } = await commitInvite(
      group,
      device2KeyBundle.publicPackage,
    )

    const { group: device2Group } = await processWelcome(
      aliceDevice2,
      invite,
      welcomeMessage,
      device2KeyBundle,
      updatedGroup.state.ratchetTree,
    )

    // Both devices can communicate
    const { message } = await updatedGroup.encrypt(new TextEncoder().encode('sync data'))
    const data = await device2Group.decrypt(message)
    expect(new TextDecoder().decode(data)).toBe('sync data')
  })
})
