# MLS External Rejoin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** reviewing

**Goal:** Add RFC 9420 external-commit support to `@enkaku/group` scoped to stale-device self-rejoin — a device with a cached `MemberCredential` can rejoin its group after falling behind epochs, using only a fresh `GroupInfo` blob from any healthy member.

**Architecture:** Two new functions wrap `ts-mls` primitives — `exportGroupInfo` (framed `MLSMessage(GroupInfo)` bytes with embedded ratchet tree + `external_pub`) and `joinGroupExternal` (decodes the blob, generates a fresh key package, calls `ts-mls.joinGroupExternal({ resync: true })`, frames + encodes the returned `PublicMessage`, wraps state in `GroupHandle`). Public API traffics only `Uint8Array` on the wire; ts-mls types stay internal.

**Tech Stack:** TypeScript, `ts-mls` (MLS/RFC 9420), `@enkaku/token` (identity/capability), vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-04-20-mls-external-rejoin-design.md`

---

## File Structure

- **Modify** `packages/group/src/group.ts` — add `exportGroupInfo`, `joinGroupExternal`, their param/result types
- **Modify** `packages/group/src/index.ts` — re-export new functions + types
- **Create** `packages/group/test/external-rejoin.test.ts` — four new tests
- **Create** `packages/group/README.md` — new file documenting external rejoin (package has no README today)

All codec handling lives inline in `group.ts` using ts-mls top-level exports (`encode`, `decode`, `mlsMessageEncoder`, `mlsMessageDecoder`, `wireformats`, `protocolVersions`) — no deep imports needed; these are all reachable from the ts-mls main barrel.

The external-rejoin output is `Uint8Array`. Existing `GroupHandle.processMessage` expects a decoded `MlsFramedMessage`, so callers must `decode(mlsMessageDecoder, bytes)` the returned `commitMessage` before passing it to other members' `processMessage`. Tests in this plan do the same.

---

## Task 1: Codec round-trip test (upgrade guard)

Anchors the symbols we depend on from `ts-mls`. Fails loudly if `ts-mls` reorganises.

**Files:**
- Create: `packages/group/test/external-rejoin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { randomIdentity } from '@enkaku/token'
import {
  decode,
  encode,
  mlsMessageDecoder,
  mlsMessageEncoder,
  protocolVersions,
  wireformats,
} from 'ts-mls'
import { describe, expect, test } from 'vitest'

import { createGroup, exportGroupInfo } from '../src/group.js'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: FAIL — `exportGroupInfo` not exported from `../src/group.js`.

- [ ] **Step 3: Add the minimal `exportGroupInfo` stub to `packages/group/src/group.ts`**

Extend the existing `ts-mls` import block to add new symbols (keep existing ones; just add these lines inside the same import statement at `packages/group/src/group.ts:3`):

```ts
  createGroupInfoWithExternalPubAndRatchetTree,
  encode,
  mlsMessageEncoder,
  protocolVersions,
  wireformats,
```

Append new types + function at the end of `group.ts`:

```ts
// ---------------------------------------------------------------------------
// External rejoin (RFC 9420 §11.2.1 — stale device self-recovery)
// ---------------------------------------------------------------------------

export type ExportGroupInfoParams = {
  group: GroupHandle
}

export type ExportGroupInfoResult = {
  /** Framed MLSMessage(GroupInfo) bytes. Self-describing with protocol
   *  version + wireformat + GroupInfo (external_pub + ratchet tree embedded). */
  groupInfo: Uint8Array
}

export async function exportGroupInfo(
  params: ExportGroupInfoParams,
): Promise<ExportGroupInfoResult> {
  const groupInfo = await createGroupInfoWithExternalPubAndRatchetTree(
    params.group.state,
    [],
    params.group.context.cipherSuite,
  )
  const framed = {
    version: protocolVersions.mls10,
    wireformat: wireformats.mls_group_info,
    groupInfo,
  } as Parameters<typeof mlsMessageEncoder>[0]
  return { groupInfo: encode(mlsMessageEncoder, framed) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/group/src/group.ts packages/group/test/external-rejoin.test.ts
git commit -m "feat(group): add exportGroupInfo for external rejoin"
```

---

## Task 2: `joinGroupExternal` — happy-path stale rejoin round trip

Implements the core stale-rejoin flow and covers Test 1 from the spec.

**Files:**
- Modify: `packages/group/src/group.ts` (add `joinGroupExternal` + types)
- Modify: `packages/group/test/external-rejoin.test.ts` (add round-trip test)

- [ ] **Step 1: Write the failing test**

Append to `packages/group/test/external-rejoin.test.ts`. Also extend the existing `ts-mls` import at the top of the file to add `nodeTypes` (used for leaf-count assertion):

```ts
// extend top-of-file import:
//   import { decode, encode, mlsMessageDecoder, mlsMessageEncoder, nodeTypes, protocolVersions, wireformats } from 'ts-mls'

import {
  commitInvite,
  createInvite,
  createKeyPackageBundle,
  joinGroupExternal,
  processWelcome,
  removeMember,
} from '../src/group.js'

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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: FAIL — `joinGroupExternal` not exported.

- [ ] **Step 3: Add `joinGroupExternal` to `packages/group/src/group.ts`**

Extend the `ts-mls` import in `packages/group/src/group.ts` to also pull in:

```ts
  decode,
  joinGroupExternal as mlsJoinGroupExternal,
  mlsMessageDecoder,
```

Append after `exportGroupInfo`:

```ts
export type JoinGroupExternalParams = {
  identity: OwnIdentity
  /** Framed MLSMessage(GroupInfo) bytes from exportGroupInfo. */
  groupInfo: Uint8Array
  /** Caller's cached credential (from prior processWelcome). Reused as-is,
   *  not re-validated. */
  credential: MemberCredential
  /** Stale-recovery only: atomically removes prior leaf for same identity. */
  resync: true
  options?: GroupOptions
  authenticatedData?: Uint8Array
}

export type JoinGroupExternalResult = {
  /** Framed MLSMessage(PublicMessage) bytes. Broadcast to existing members. */
  commitMessage: Uint8Array
  /** New GroupHandle at post-commit epoch. */
  group: GroupHandle
}

export async function joinGroupExternal(
  params: JoinGroupExternalParams,
): Promise<JoinGroupExternalResult> {
  const { identity, groupInfo: groupInfoBytes, credential, resync, options, authenticatedData } =
    params

  const rootCapability = credential.capabilityChain[0]
  if (rootCapability == null) {
    throw new Error('Invalid credential: capability chain must not be empty')
  }

  const context = await resolveMlsContext(options)

  const message = decode(mlsMessageDecoder, groupInfoBytes)
  if (message == null) {
    throw new Error('Invalid groupInfo: failed to decode MLSMessage')
  }
  if (message.wireformat !== wireformats.mls_group_info) {
    throw new Error(
      `Invalid groupInfo: expected wireformat mls_group_info, got ${String(message.wireformat)}`,
    )
  }
  const groupInfo = (message as { groupInfo: Parameters<typeof mlsJoinGroupExternal>[0]['groupInfo'] }).groupInfo

  const keyPackage = await generateKeyPackageWithKey({
    credential: makeMLSCredential(identity.id),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite: context.cipherSuite,
  })

  const { publicMessage, newState } = await mlsJoinGroupExternal({
    context,
    groupInfo,
    keyPackage: keyPackage.publicPackage,
    privateKeys: keyPackage.privatePackage,
    resync,
    ...(authenticatedData != null && { authenticatedData }),
  })

  const framedCommit = {
    version: protocolVersions.mls10,
    wireformat: wireformats.mls_public_message,
    publicMessage,
  } as Parameters<typeof mlsMessageEncoder>[0]
  const commitMessage = encode(mlsMessageEncoder, framedCommit)

  const group = new GroupHandle({
    state: newState,
    credential,
    context,
    rootCapability,
  })

  return { commitMessage, group }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/group/src/group.ts packages/group/test/external-rejoin.test.ts
git commit -m "feat(group): add joinGroupExternal for stale device recovery"
```

---

## Task 3: Empty credential chain rejected

Explicitly surface the error case.

**Files:**
- Modify: `packages/group/test/external-rejoin.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('joinGroupExternal — stale device recovery', …)` block:

```ts
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
```

Add the import at the top of the file:

```ts
import type { MemberCredential } from '../src/credential.js'
```

- [ ] **Step 2: Run test to verify it passes**

The check is already in `joinGroupExternal` (Task 2), so this test should pass immediately — it's an assertion that the guard works end-to-end rather than a new code path.

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/group/test/external-rejoin.test.ts
git commit -m "test(group): cover empty capability chain rejection on external rejoin"
```

---

## Task 4: Third member observes rejoin

Covers Test 3 — an online third member processes the external commit and converges with both A and B.

**Files:**
- Modify: `packages/group/test/external-rejoin.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('joinGroupExternal — stale device recovery', …)` block:

```ts
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
    const { commitMessage: addCarolCommit, welcomeMessage: carolWelcome, newGroup: aliceB } =
      await commitInvite(aliceA, carolKP.publicPackage)
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

    // B goes stale: A and C advance by removing/readding churn — simulated by one
    // no-op commit from A (add then later remove a throwaway key package would
    // advance epoch). Simplest: A creates a plain commit with no proposals isn't
    // available; instead, have A add + remove a fourth identity.
    const dave = randomIdentity()
    const { invite: daveInvite } = await createInvite({
      group: aliceB,
      identity: alice,
      recipientDID: dave.id,
      permission: 'member',
    })
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: PASS. No impl changes needed — pure coverage test exercising already-implemented code paths.

- [ ] **Step 3: Commit**

```bash
git add packages/group/test/external-rejoin.test.ts
git commit -m "test(group): cover third-member convergence after external rejoin"
```

---

## Task 5: Public API exports

Expose the new functions and types from the package entry point.

**Files:**
- Modify: `packages/group/src/index.ts`

- [ ] **Step 1: Write a test that imports from the package root**

Append to `packages/group/test/external-rejoin.test.ts`:

```ts
describe('public API', () => {
  test('external rejoin symbols are exported from package root', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.exportGroupInfo).toBe('function')
    expect(typeof mod.joinGroupExternal).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: FAIL — `exportGroupInfo` / `joinGroupExternal` undefined on the barrel.

- [ ] **Step 3: Add exports to `packages/group/src/index.ts`**

Extend the existing `export { … } from './group.js'` block so it includes the new names:

```ts
export {
  type CommitInviteResult,
  type CreateGroupResult,
  type CreateInviteParams,
  type CreateInviteResult,
  type ExportGroupInfoParams,
  type ExportGroupInfoResult,
  type JoinGroupExternalParams,
  type JoinGroupExternalResult,
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  exportGroupInfo,
  GroupHandle,
  type GroupHandleParams,
  joinGroupExternal,
  type ProcessWelcomeParams,
  type ProcessWelcomeResult,
  processWelcome,
  type RemoveMemberResult,
  type RestoreGroupParams,
  removeMember,
  restoreGroup,
} from './group.js'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/group test -- external-rejoin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/group/src/index.ts packages/group/test/external-rejoin.test.ts
git commit -m "feat(group): export exportGroupInfo and joinGroupExternal"
```

---

## Task 6: Package README

Create `packages/group/README.md` documenting the package and the new external-rejoin flow, including the security caveat mandated by the spec.

**Files:**
- Create: `packages/group/README.md`

- [ ] **Step 1: Write `packages/group/README.md`**

```markdown
# @enkaku/group

Credential-aware MLS (RFC 9420) group lifecycle for enkaku. Wraps [`ts-mls`](https://github.com/LukaJCB/ts-mls) with DID-based capabilities, giving every member a `MemberCredential` that ties their MLS leaf to a signed capability chain.

## Capabilities

- `createGroup` — admin creates a new group with themselves as sole member
- `createInvite` + `commitInvite` — admin delegates a capability and produces the MLS Commit + Welcome
- `processWelcome` — invitee joins after validating the capability chain
- `removeMember` — admin evicts a leaf and rotates keys
- `restoreGroup` — rehydrate a `GroupHandle` from persisted `ClientState`
- `exportGroupInfo` + `joinGroupExternal` — stale-device self-rejoin (see below)

## External rejoin (stale device recovery)

Each device owns its MLS leaf and ratchet state. A device that stays offline long enough for the group to advance epochs (adds, removes, key rotations) can no longer decrypt current application messages. Replaying every missed commit sequentially is expensive and may be impossible if intermediate commits are no longer available.

RFC 9420 §11.2.1 defines an external commit: a non-member (or stale member) builds a Commit using only the group's `GroupInfo` (carrying an `external_pub` key). `@enkaku/group` wraps this for the stale-member case — same DID, cached `MemberCredential`, `resync: true` so the joiner's old leaf is removed in the same commit.

```ts
// On any healthy member (online, current epoch):
import { exportGroupInfo } from '@enkaku/group'
const { groupInfo } = await exportGroupInfo({ group: aliceGroup })
// groupInfo is a Uint8Array framed as MLSMessage(GroupInfo). Ship it to the stale device.

// On the stale device:
import { joinGroupExternal } from '@enkaku/group'
const { commitMessage, group } = await joinGroupExternal({
  identity: bob,                    // OwnIdentity from @enkaku/token
  groupInfo,                        // bytes received from the healthy member
  credential: bobStoredCredential,  // cached from the original processWelcome
  resync: true,
})
// Broadcast commitMessage (Uint8Array) to the other members; each calls group.processMessage(commitMessage).
// The returned `group` is already at the post-commit epoch — ready to encrypt/decrypt.
```

### Trust model

Stale rejoin reuses the caller's previously accepted credential. The capability chain is **not** re-validated during `joinGroupExternal` — we trust what the caller already stored from `processWelcome`. Existing members validate the commit sender's identity as part of normal MLS processing.

### Transport

`@enkaku/group` ships bytes, not channels. Callers own:
- Delivering `groupInfo` bytes from a healthy member to the stale device (e.g. via a hub, directory service, or DM).
- Broadcasting `commitMessage` bytes to every other member.
- Rebuilding application state (message backlog, per-member projections) — enkaku does not replay missed application messages.

### Not yet supported

- **Fresh external join by a new DID.** Requires deciding how a non-member acquires a `MemberCredential` without a live inviter.
- **Member-proposed external add.** `proposeAddExternal` is not wrapped yet.
- **Non-resync external join.** Only `resync: true` is supported.

### ⚠️ Security: removal is not revocation

MLS has no cryptographic member revocation. A device that retains its `MemberCredential` can rejoin via `joinGroupExternal` **even after being removed from the group**, provided it can still obtain a fresh `GroupInfo`. Consumers must assume a removed member can rejoin until capability-level revocation lands in a follow-up spec. Mitigations available today:

- Rotate the group: create a new group, migrate non-removed members via fresh invites, abandon the old group.
- Enforce access control outside MLS: block the removed device at the transport layer (e.g. hub auth).

The follow-up capability-revocation work will introduce signed `RevokeMember` tokens synced via a GroupContext extension, with member-side enforcement in `processMessage`.
```

- [ ] **Step 2: Lint / format check**

Run: `pnpm run lint`
Expected: no formatting errors introduced by the new README (markdown is ignored by biome lint but passes format).

- [ ] **Step 3: Commit**

```bash
git add packages/group/README.md
git commit -m "docs(group): document external rejoin + removal-is-not-revocation caveat"
```

---

## Task 7: Full test + build verification

Final gate before handing off for review.

- [ ] **Step 1: Run the full group package test suite**

Run: `pnpm --filter @enkaku/group test`
Expected: all tests pass (new external-rejoin tests + all pre-existing tests).

- [ ] **Step 2: Run workspace-wide type check and tests**

Run: `pnpm run test`
Expected: PASS. No type regressions in dependent packages (none expected since we only added new exports).

- [ ] **Step 3: Build everything**

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `pnpm run lint`
Expected: no new issues.

- [ ] **Step 5: Update plan stage**

Edit `docs/superpowers/plans/2026-04-20-mls-external-rejoin.md` and change the header line:

```
**Stage:** planning
```

to:

```
**Stage:** reviewing
```

Commit:

```bash
git add docs/superpowers/plans/2026-04-20-mls-external-rejoin.md
git commit -m "chore: mark MLS external rejoin plan as ready for review"
```
