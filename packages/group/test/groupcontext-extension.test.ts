import { randomIdentity } from '@enkaku/token'
import { defaultCapabilities, makeCustomExtension } from 'ts-mls'
import { describe, expect, test } from 'vitest'

import {
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
) {
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
