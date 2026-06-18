import { randomIdentity } from '@enkaku/token'
import {
  createCommit,
  defaultCapabilities,
  defaultProposalTypes,
  encode,
  type IncomingMessageCallback,
  makeCustomExtension,
  mlsMessageEncoder,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

import {
  CommitRejectedError,
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  processWelcome,
} from '../src/group.js'

// kubun's genesis-anchor extension type (custom, non-default).
const ANCHOR_TYPE = 0xff00

function anchorExtension(did: string) {
  return makeCustomExtension({
    extensionType: ANCHOR_TYPE,
    extensionData: new TextEncoder().encode(did),
  })
}

function readAnchor(
  extensions: ReadonlyArray<{
    extensionType: number
    extensionData: unknown
  }>,
): string | undefined {
  const ext = extensions.find((e) => e.extensionType === ANCHOR_TYPE)
  return ext == null || !(ext.extensionData instanceof Uint8Array)
    ? undefined
    : new TextDecoder().decode(ext.extensionData)
}

describe('Gap 1 — custom GroupContext extension capabilities', () => {
  test('anchored group can invite and admit a member who reads the anchor', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    // Creator bakes the anchor into the GroupContext.
    const { group: aliceGroup } = await createGroup(alice, 'anchored-group', {
      extensions: [anchorExtension(alice.id)],
    })
    // Creator can read its own anchor.
    expect(readAnchor(aliceGroup.state.groupContext.extensions)).toBe(alice.id)

    // Invitee generates a KeyPackage advertising the anchor capability.
    const bobBundle = await createKeyPackageBundle(bob, {
      capabilities: { ...defaultCapabilities(), extensions: [ANCHOR_TYPE] },
    })

    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })

    // This previously threw: "Added leaf node that doesn't support extension in GroupContext".
    const { welcomeMessage, commitMessage } = await commitInvite(
      aliceGroup,
      bobBundle.publicPackage,
    )
    expect(commitMessage).toBeInstanceOf(Uint8Array)

    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
    })
    // Joiner reads the same anchor after processWelcome.
    expect(readAnchor(bobGroup.state.groupContext.extensions)).toBe(alice.id)
  })

  test('group without custom extensions is unaffected', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const { group: aliceGroup } = await createGroup(alice, 'plain-group')
    const bobBundle = await createKeyPackageBundle(bob)
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const { welcomeMessage } = await commitInvite(aliceGroup, bobBundle.publicPackage)
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
    })
    expect(bobGroup.memberCount).toBe(2)
  })
})

// Reject any commit that carries a group_context_extensions proposal touching
// the anchor type — kubun's immutability policy, expressed as a raw callback.
const rejectAnchorMutation: IncomingMessageCallback = (incoming) => {
  if (incoming.kind === 'commit') {
    for (const { proposal } of incoming.proposals) {
      if (
        proposal.proposalType === defaultProposalTypes.group_context_extensions &&
        'groupContextExtensions' in proposal &&
        proposal.groupContextExtensions.extensions.some((e) => e.extensionType === ANCHOR_TYPE)
      ) {
        return 'reject'
      }
    }
  }
  return 'accept'
}

describe('Gap 2 — commit policy hook', () => {
  test('per-handle policy rejects an anchor-mutating commit and keeps the epoch', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    // Alice creates the anchored group with the immutability policy seeded.
    const { group: aliceGroup } = await createGroup(alice, 'g2-group', {
      extensions: [anchorExtension(alice.id)],
      commitPolicy: rejectAnchorMutation,
    })
    const bobBundle = await createKeyPackageBundle(bob, {
      capabilities: { ...defaultCapabilities(), extensions: [ANCHOR_TYPE] },
    })
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const { welcomeMessage, newGroup: aliceAfterBob } = await commitInvite(
      aliceGroup,
      bobBundle.publicPackage,
    )
    // Bob joins with the same policy seeded; both now at epoch 1.
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
      options: { commitPolicy: rejectAnchorMutation },
    })
    const epochBefore = bobGroup.epoch

    // Alice commits a group_context_extensions change rewriting the anchor.
    const mutation = await createCommit({
      context: aliceAfterBob.context,
      state: aliceAfterBob.state,
      extraProposals: [
        {
          proposalType: defaultProposalTypes.group_context_extensions,
          groupContextExtensions: { extensions: [anchorExtension(bob.id)] },
        },
      ],
    })
    const mutatingCommit = encode(mlsMessageEncoder, mutation.commit)

    // Bob's policy rejects it; epoch unchanged.
    await expect(bobGroup.processMessage(mutatingCommit)).rejects.toBeInstanceOf(
      CommitRejectedError,
    )
    expect(bobGroup.epoch).toBe(epochBefore)
  })

  test('normal Add commit is unaffected by the policy', async () => {
    // A policy that rejects anchor mutations must not reject an ordinary add.
    const alice = randomIdentity()
    const bob = randomIdentity()
    const carol = randomIdentity()
    const { group: aliceGroup } = await createGroup(alice, 'g2-plain', {
      commitPolicy: rejectAnchorMutation,
    })
    const bobBundle = await createKeyPackageBundle(bob)
    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const { welcomeMessage, newGroup: aliceAfterBob } = await commitInvite(
      aliceGroup,
      bobBundle.publicPackage,
    )
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
      options: { commitPolicy: rejectAnchorMutation },
    })

    // Alice adds Carol; Bob applies the add commit cleanly under the policy.
    const carolBundle = await createKeyPackageBundle(carol)
    await createInvite({
      group: aliceAfterBob,
      identity: alice,
      recipientDID: carol.id,
      permission: 'member',
    })
    const { commitMessage } = await commitInvite(aliceAfterBob, carolBundle.publicPackage)

    await expect(bobGroup.processMessage(commitMessage)).resolves.toBeNull()
    expect(bobGroup.memberCount).toBe(3)
  })

  test('per-call commitPolicy overrides the per-handle default', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const carol = randomIdentity()
    // Bob's handle default accepts everything; the per-call policy rejects all.
    const acceptAll: IncomingMessageCallback = () => 'accept'
    const rejectAll: IncomingMessageCallback = () => 'reject'

    const { group: aliceGroup } = await createGroup(alice, 'g2-override')
    const bobBundle = await createKeyPackageBundle(bob)
    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const { welcomeMessage, newGroup: aliceAfterBob } = await commitInvite(
      aliceGroup,
      bobBundle.publicPackage,
    )
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
      options: { commitPolicy: acceptAll },
    })
    const epochBefore = bobGroup.epoch

    // Alice adds Carol; Bob's per-call rejectAll overrides his accept default.
    const carolBundle = await createKeyPackageBundle(carol)
    const { commitMessage } = await commitInvite(aliceAfterBob, carolBundle.publicPackage)

    await expect(
      bobGroup.processMessage(commitMessage, { commitPolicy: rejectAll }),
    ).rejects.toBeInstanceOf(CommitRejectedError)
    expect(bobGroup.epoch).toBe(epochBefore)
  })
})
