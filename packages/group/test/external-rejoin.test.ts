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
    // Carol never calls processWelcome here (she's only added to advance epochs),
    // so we skip createInvite and go straight to key package + commitInvite.
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

  test('third online member processes external rejoin and converges', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const carol = randomIdentity()

    // Group of A, B, C with all online
    const { group: aliceGroup } = await createGroup(alice, 'trio-group')

    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage: bobWelcome, newGroup: aliceA } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )
    const { group: bobGroup, credential: bobCred } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: bobWelcome,
      keyPackageBundle: bobKP,
      ratchetTree: aliceA.state.ratchetTree,
    })

    const { invite: carolInvite } = await createInvite({
      group: aliceA,
      identity: alice,
      recipientDID: carol.id,
      permission: 'member',
    })
    const carolKP = await createKeyPackageBundle(carol)
    const {
      commitMessage: addCarolCommit,
      welcomeMessage: carolWelcome,
      newGroup: aliceB,
    } = await commitInvite(aliceA, carolKP.publicPackage)
    await bobGroup.processMessage(addCarolCommit)
    const { group: carolGroup } = await processWelcome({
      identity: carol,
      invite: carolInvite,
      welcome: carolWelcome,
      keyPackageBundle: carolKP,
      ratchetTree: aliceB.state.ratchetTree,
    })
    expect(aliceB.epoch).toBe(2n)
    expect(bobGroup.epoch).toBe(2n)
    expect(carolGroup.epoch).toBe(2n)

    // B goes stale: A and C advance by adding + removing D. B skips these commits.
    const dave = randomIdentity()
    const daveKP = await createKeyPackageBundle(dave)
    const { commitMessage: addDave, newGroup: aliceC } = await commitInvite(
      aliceB,
      daveKP.publicPackage,
    )
    await carolGroup.processMessage(addDave)
    // B skips this commit — now stale.

    const daveLeaf = aliceC.findMemberLeafIndex(dave.id)
    const { commitMessage: rmDave, newGroup: aliceD } = await removeMember(
      aliceC,
      daveLeaf as number,
    )
    await carolGroup.processMessage(rmDave)
    expect(aliceD.epoch).toBe(4n)
    expect(carolGroup.epoch).toBe(4n)
    expect(bobGroup.epoch).toBe(2n)

    // B rejoins externally
    const { groupInfo } = await exportGroupInfo({ group: aliceD })
    const { commitMessage: rejoinCommit, group: bobRejoined } = await joinGroupExternal({
      identity: bob,
      groupInfo,
      credential: bobCred,
      resync: true,
    })

    // A and C both decode + process B's rejoin commit
    const decodedRejoin = decode(mlsMessageDecoder, rejoinCommit)
    if (decodedRejoin == null) throw new Error('failed to decode rejoin commit')
    await aliceD.processMessage(decodedRejoin)
    await carolGroup.processMessage(decodedRejoin)
    expect(aliceD.epoch).toBe(bobRejoined.epoch)
    expect(carolGroup.epoch).toBe(bobRejoined.epoch)

    // C encrypts; A and B decrypt
    const { message } = await carolGroup.encrypt(new TextEncoder().encode('hi all'))
    const aliceGot = await aliceD.decrypt(message)
    const bobGot = await bobRejoined.decrypt(message)
    expect(new TextDecoder().decode(aliceGot)).toBe('hi all')
    expect(new TextDecoder().decode(bobGot)).toBe('hi all')
  })
})

describe('public API', () => {
  test('external rejoin symbols are exported from package root', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.exportGroupInfo).toBe('function')
    expect(typeof mod.joinGroupExternal).toBe('function')
  })
})
