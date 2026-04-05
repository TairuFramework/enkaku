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

// Simulate JSON roundtrip effect: undefined array entries become null.
// In practice this happens when ratchet trees are transported as JSON between
describe('ratchet tree extension', () => {
  test('processWelcome joins without ratchetTree param (tree embedded in Welcome)', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'ext-join')
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: updatedAlice } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )

    // No ratchetTree param — tree comes from the Welcome message
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKP,
    })

    expect(bobGroup.memberCount).toBe(2)

    const { message } = await updatedAlice.encrypt(new TextEncoder().encode('no tree needed'))
    const decrypted = await bobGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('no tree needed')
  })

  test('3-member join without ratchetTree param', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const charlie = randomIdentity()

    const { group: g1 } = await createGroup(alice, 'ext-3m')

    const { invite: bobInvite } = await createInvite({
      group: g1,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage: bobWelcome, newGroup: g2 } = await commitInvite(g1, bobKP.publicPackage)
    await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: bobWelcome,
      keyPackageBundle: bobKP,
    })

    const { invite: charlieInvite } = await createInvite({
      group: g2,
      identity: alice,
      recipientDID: charlie.id,
      permission: 'member',
    })
    const charlieKP = await createKeyPackageBundle(charlie)
    const { welcomeMessage: charlieWelcome, newGroup: g3 } = await commitInvite(
      g2,
      charlieKP.publicPackage,
    )
    const { group: charlieGroup } = await processWelcome({
      identity: charlie,
      invite: charlieInvite,
      welcome: charlieWelcome,
      keyPackageBundle: charlieKP,
    })

    expect(g3.memberCount).toBe(3)
    expect(charlieGroup.memberCount).toBe(3)

    const { message } = await g3.encrypt(new TextEncoder().encode('extension works'))
    const decrypted = await charlieGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('extension works')
  })
})

// Simulate JSON roundtrip effect: undefined array entries become null.
// In practice this happens when ratchet trees are transported as JSON between
// peers (e.g. Kubun's invite payloads use JSON.stringify with a custom replacer
// that handles Uint8Array/BigInt but not undefined array entries).
function nullifyTree(tree: ReadonlyArray<unknown>): Array<unknown> {
  return tree.map((entry) => (entry === undefined ? null : entry))
}

describe('JSON serialization null safety', () => {
  test('processWelcome joins and exchanges messages with nullified 2-member tree', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'null-2m')
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: updatedAlice } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )

    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKP,
      ratchetTree: nullifyTree(updatedAlice.state.ratchetTree),
    })

    expect(bobGroup.memberCount).toBe(2)

    // Verify full participation — not just memberCount
    const { message } = await updatedAlice.encrypt(new TextEncoder().encode('hello bob'))
    const decrypted = await bobGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('hello bob')
  })

  test('processWelcome joins 3-member group with nullified tree', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const charlie = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'null-3m')

    // Add Bob normally
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

    // Add Charlie with nullified tree — tree has blank parent nodes
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

    const nullified = nullifyTree(groupWith3.state.ratchetTree)
    // Verify the tree actually has null entries (blank parent nodes)
    expect(nullified.some((entry) => entry === null)).toBe(true)

    const { group: charlieGroup } = await processWelcome({
      identity: charlie,
      invite: charlieInvite,
      welcome: charlieWelcome,
      keyPackageBundle: charlieKP,
      ratchetTree: nullified,
    })

    expect(charlieGroup.memberCount).toBe(3)

    const { message } = await groupWith3.encrypt(new TextEncoder().encode('to charlie'))
    const decrypted = await charlieGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('to charlie')
  })

  test('processWelcome joins after member removal with nullified tree', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const charlie = randomIdentity()
    const dave = randomIdentity()

    const { group: g1 } = await createGroup(alice, 'null-remove')

    // Add Bob
    const { invite: bobInvite } = await createInvite({
      group: g1,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage: bobWelcome, newGroup: g2 } = await commitInvite(g1, bobKP.publicPackage)
    await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: bobWelcome,
      keyPackageBundle: bobKP,
      ratchetTree: g2.state.ratchetTree,
    })

    // Add Charlie
    await createInvite({
      group: g2,
      identity: alice,
      recipientDID: charlie.id,
      permission: 'member',
    })
    const charlieKP = await createKeyPackageBundle(charlie)
    const { newGroup: g3 } = await commitInvite(g2, charlieKP.publicPackage)

    // Remove Bob — creates blank leaf node in tree
    const { newGroup: g4 } = await removeMember(g3, 1)
    expect(g4.memberCount).toBe(2)

    // Invite Dave — tree now has both blank leaf (from removal) and blank parents
    const { invite: daveInvite } = await createInvite({
      group: g4,
      identity: alice,
      recipientDID: dave.id,
      permission: 'member',
    })
    const daveKP = await createKeyPackageBundle(dave)
    const { welcomeMessage: daveWelcome, newGroup: g5 } = await commitInvite(
      g4,
      daveKP.publicPackage,
    )

    const nullified = nullifyTree(g5.state.ratchetTree)
    expect(nullified.some((entry) => entry === null)).toBe(true)

    const { group: daveGroup } = await processWelcome({
      identity: dave,
      invite: daveInvite,
      welcome: daveWelcome,
      keyPackageBundle: daveKP,
      ratchetTree: nullified,
    })

    expect(daveGroup.memberCount).toBe(3)

    const { message } = await g5.encrypt(new TextEncoder().encode('welcome dave'))
    const decrypted = await daveGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('welcome dave')
  })

  test('findMemberLeafIndex works with nullified tree entries', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'null-find')
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage, newGroup: updatedAlice } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )

    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKP,
      ratchetTree: nullifyTree(updatedAlice.state.ratchetTree),
    })

    // findMemberLeafIndex should work on the joined group
    // (its internal tree was built by ts-mls from the sanitized input)
    expect(bobGroup.findMemberLeafIndex(bob.id)).toBe(1)
    expect(bobGroup.findMemberLeafIndex(alice.id)).toBe(0)
    expect(bobGroup.findMemberLeafIndex('did:key:unknown')).toBeUndefined()
  })
})
