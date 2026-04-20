import { randomIdentity } from '@enkaku/token'
import {
  decode,
  encode,
  mlsMessageDecoder,
  mlsMessageEncoder,
  nodeTypes,
  protocolVersions,
  wireformats,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

import type { MemberCredential } from '../src/credential.js'

import {
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  exportGroupInfo,
  joinGroupExternal,
  processWelcome,
  removeMember,
} from '../src/group.js'

describe('external rejoin codec round-trip', () => {
  test('mlsMessage(GroupInfo) encode → decode preserves version + wireformat', async () => {
    const alice = randomIdentity()
    const { group } = await createGroup(alice, 'codec-rt-group')

    const { groupInfo } = await exportGroupInfo({ group })
    expect(groupInfo).toBeInstanceOf(Uint8Array)

    const decoded = decode(mlsMessageDecoder, groupInfo)
    expect(decoded).toBeDefined()
    if (decoded == null) throw new Error('unreachable')
    expect(decoded.version).toBe(protocolVersions.mls10)
    expect(decoded.wireformat).toBe(wireformats.mls_group_info)

    // Re-encode and compare — round-trip stability
    const reencoded = encode(mlsMessageEncoder, decoded)
    expect(reencoded.length).toBe(groupInfo.length)
    expect(reencoded).toEqual(groupInfo)
  })
})

describe('joinGroupExternal — stale device recovery', () => {
  test('B falls behind, rejoins externally, resumes round-trip messaging', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const carol = randomIdentity()

    // A creates group, invites B
    const { group: aliceGroup } = await createGroup(alice, 'stale-rejoin-group')
    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage: bobWelcome, newGroup: aliceAfterBob } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )
    const { group: bobGroup, credential: bobCred } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: bobWelcome,
      keyPackageBundle: bobKP,
      ratchetTree: aliceAfterBob.state.ratchetTree,
    })
    expect(bobGroup.epoch).toBe(1n)

    // A advances: add C, then remove C. B stays offline.
    const { invite: carolInvite } = await createInvite({
      group: aliceAfterBob,
      identity: alice,
      recipientDID: carol.id,
      permission: 'member',
    })
    const carolKP = await createKeyPackageBundle(carol)
    const { newGroup: aliceAfterCarol } = await commitInvite(aliceAfterBob, carolKP.publicPackage)
    const carolLeaf = aliceAfterCarol.findMemberLeafIndex(carol.id)
    expect(carolLeaf).toBeDefined()
    const { newGroup: aliceAdvanced } = await removeMember(aliceAfterCarol, carolLeaf as number)
    expect(aliceAdvanced.epoch).toBe(3n)
    expect(bobGroup.epoch).toBe(1n) // B still stale

    // A publishes a message B cannot decrypt at its stale epoch
    const { message: staleMsg } = await aliceAdvanced.encrypt(new TextEncoder().encode('locked'))
    await expect(bobGroup.decrypt(staleMsg)).rejects.toThrow()

    // A exports GroupInfo; B rejoins externally using its cached credential
    const { groupInfo } = await exportGroupInfo({ group: aliceAdvanced })
    const { commitMessage, group: bobRejoined } = await joinGroupExternal({
      identity: bob,
      groupInfo,
      credential: bobCred,
      resync: true,
    })
    expect(commitMessage).toBeInstanceOf(Uint8Array)
    expect(bobRejoined.epoch).toBe(aliceAdvanced.epoch + 1n)

    // A decodes and processes B's rejoin commit
    const decodedRejoin = decode(mlsMessageDecoder, commitMessage)
    if (decodedRejoin == null) throw new Error('failed to decode rejoin commit')
    await aliceAdvanced.processMessage(decodedRejoin)
    expect(aliceAdvanced.epoch).toBe(bobRejoined.epoch)

    // Round-trip messaging resumes
    const { message: msgAB } = await aliceAdvanced.encrypt(new TextEncoder().encode('welcome back'))
    const got = await bobRejoined.decrypt(msgAB)
    expect(new TextDecoder().decode(got)).toBe('welcome back')

    const { message: msgBA } = await bobRejoined.encrypt(new TextEncoder().encode('thanks'))
    const gotBA = await aliceAdvanced.decrypt(msgBA)
    expect(new TextDecoder().decode(gotBA)).toBe('thanks')

    // B's DID appears exactly once in the tree post-rejoin (resync removed old leaf)
    const bobLeafIndex = aliceAdvanced.findMemberLeafIndex(bob.id)
    expect(bobLeafIndex).toBeDefined()
    const bobLeafCount = aliceAdvanced.state.ratchetTree.filter(
      (node) =>
        node != null &&
        node.nodeType === nodeTypes.leaf &&
        'identity' in node.leaf.credential &&
        new TextDecoder().decode(node.leaf.credential.identity) === bob.id,
    ).length
    expect(bobLeafCount).toBe(1)
  })

  test('rejects credential with empty capability chain', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const { group: aliceGroup } = await createGroup(alice, 'empty-chain-group')
    const { groupInfo } = await exportGroupInfo({ group: aliceGroup })

    await expect(
      joinGroupExternal({
        identity: bob,
        groupInfo,
        credential: {
          did: bob.id,
          capabilityChain: [],
          capability: {} as MemberCredential['capability'],
          permission: 'member',
          groupID: 'empty-chain-group',
        },
        resync: true,
      }),
    ).rejects.toThrow('capability chain must not be empty')
  })
})
