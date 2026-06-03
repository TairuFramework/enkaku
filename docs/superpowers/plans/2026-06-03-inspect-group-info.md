# `inspectGroupInfo` Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-destructive `inspectGroupInfo(bytes)` to `@enkaku/group` that returns a GroupInfo's `epoch` and `treeHash` without joining or mutating state, plus a `GroupHandle.treeHash` getter for symmetric comparison.

**Architecture:** `inspectGroupInfo` decodes the framed MLSMessage(GroupInfo) (reusing `joinGroupExternal`'s decode + wireformat guards) and reads `epoch` and `treeHash` straight off `message.groupInfo.groupContext`. No ratchet-tree decode (the ts-mls tree decoder is not public). Confirmation of a resync commit is done by the consumer comparing `(epoch, treeHash)` for equality against its own post-commit state — a stronger check than "my leaf present".

**Tech Stack:** TypeScript, ts-mls (MLS primitives), vitest, pnpm.

---

## Background for the implementer

- `@enkaku/group` lives at `packages/group`. Build all packages from repo root with `pnpm run build`; run this package's unit tests with `pnpm --filter @enkaku/group run test:unit` (vitest).
- **Lint:** use `rtk proxy pnpm run lint` from repo root (NOT bare `pnpm run lint`).
- Repo guardrails (from `AGENTS.md`): `type` not `interface`; `Array<T>` not `T[]`; no `any`; `HTTP`/`ID`/`JWT` casing; never edit generated files (`.gen.ts`, `lib/`).
- Key existing code to mirror:
  - `joinGroupExternal` decode guards — `packages/group/src/group.ts:688-696` (the exact decode-null + wireformat checks to copy).
  - `readMessageEpoch` — `packages/group/src/group.ts:573-589` (contrast: total/never-throws; the inspector instead throws on malformed input).
  - `GroupHandle.epoch` getter — `packages/group/src/group.ts:120-122` (the pattern the `treeHash` getter mirrors).
  - `exportGroupInfo` — `packages/group/src/group.ts:621-635`.
- `decode`, `mlsMessageDecoder`, `wireformats` are ALREADY imported in `group.ts` (lines 11-38). No new imports needed.
- `GroupContext` (from the decoded `message.groupInfo.groupContext`) has public fields `epoch: bigint` and `treeHash: Uint8Array`. Verified at runtime: `message.groupInfo.groupContext.treeHash` deep-equals the source handle's `state.groupContext.treeHash`.
- **Do NOT** attempt to read member leaves / ratchet tree from the GroupInfo: `ratchetTreeFromExtension` and `ratchetTreeDecoder` are not in ts-mls's public exports, and deep imports are blocked by the package `exports` map. The spec's Revision note explains this.
- Spec: `docs/superpowers/specs/2026-06-03-inspect-group-info-design.md`.

---

## Task 1: Implement `inspectGroupInfo` + `GroupHandle.treeHash` getter (TDD)

**Files:**
- Create: `packages/group/test/inspect-group-info.test.ts`
- Modify: `packages/group/src/group.ts` (add `treeHash` getter; add type + function)
- Modify: `packages/group/src/index.ts` (export)

- [ ] **Step 1: Write the failing test file**

Create `packages/group/test/inspect-group-info.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to confirm it fails for the right reason**

Run: `pnpm --filter @enkaku/group run test:unit -- inspect-group-info.test.ts`
Expected: FAIL — `inspectGroupInfo` is not exported / `group.treeHash` is not a function (import or property error).

- [ ] **Step 3: Add the `treeHash` getter to `GroupHandle`**

In `packages/group/src/group.ts`, directly after the `epoch` getter (`group.ts:120-122`), add:

```ts
  get treeHash(): Uint8Array {
    return this.#state.groupContext.treeHash
  }
```

- [ ] **Step 4: Implement `inspectGroupInfo` + `InspectGroupInfoResult`**

In `packages/group/src/group.ts`, add directly after `readMessageEpoch` (ends at line 589):

```ts
export type InspectGroupInfoResult = {
  /** The GroupInfo's epoch, read from its groupContext. */
  epoch: bigint
  /** The GroupInfo's ratchet-tree hash, read from its groupContext. Compare for
   *  equality against a known post-commit state's treeHash to confirm canonical
   *  convergence (same epoch + same treeHash ⟺ same group state). */
  treeHash: Uint8Array
}

/**
 * Non-destructively inspect a framed MLSMessage(GroupInfo) — read its epoch and
 * ratchet-tree hash without joining or mutating any state. Used to confirm an
 * external-resync Commit was canonically accepted: compare the returned
 * (epoch, treeHash) for equality against the rejoiner's own post-commit state
 * (GroupHandle.epoch / GroupHandle.treeHash). Equal ⟹ this device's Commit won
 * the epoch; unequal ⟹ another Commit won and the rejoin must retry.
 *
 * Structural read only: it does NOT verify the GroupInfo signature. The caller
 * is expected to have obtained the bytes over the group's authorized channel.
 * Unlike readMessageEpoch (a total pre-filter over untrusted DS bytes), this
 * THROWS on malformed input — a malformed already-trusted GroupInfo is a
 * programming error, not expected traffic.
 */
export function inspectGroupInfo(groupInfoBytes: Uint8Array): InspectGroupInfoResult {
  const message = decode(mlsMessageDecoder, groupInfoBytes)
  if (message == null) {
    throw new Error('Invalid groupInfo: failed to decode MLSMessage')
  }
  if (message.wireformat !== wireformats.mls_group_info) {
    throw new Error(
      `Invalid groupInfo: expected wireformat mls_group_info, got ${String(message.wireformat)}`,
    )
  }
  const { groupContext } = message.groupInfo
  return { epoch: groupContext.epoch, treeHash: groupContext.treeHash }
}
```

- [ ] **Step 5: Export from `index.ts`**

In `packages/group/src/index.ts`, add to the existing `from './group.js'` block (spanning lines 29-55) — insert in alphabetical position (e.g. between `GroupHandle*` and the `JoinGroupExternal*` entries):

```ts
  inspectGroupInfo,
  type InspectGroupInfoResult,
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `pnpm --filter @enkaku/group run test:unit -- inspect-group-info.test.ts`
Expected: PASS (all 4 tests green).

- [ ] **Step 7: Type-check the whole package**

Run: `pnpm --filter @enkaku/group run test:types`
Expected: PASS (no type errors).

- [ ] **Step 8: Lint**

Run (from repo root): `rtk proxy pnpm run lint`
Expected: clean (formatter may rewrite import ordering — accept its output).

- [ ] **Step 9: Commit**

```bash
git add packages/group/src/group.ts packages/group/src/index.ts packages/group/test/inspect-group-info.test.ts
git commit -m "feat(group): inspectGroupInfo + GroupHandle.treeHash for resync confirmation"
```

---

## Task 2: Version bump + build

**Files:**
- Modify: `packages/group/package.json` (version field)

- [ ] **Step 1: Bump the version**

Edit `packages/group/package.json`: change `"version": "0.16.1"` to `"version": "0.16.2"`.

- [ ] **Step 2: Build all packages**

Run (from repo root): `pnpm run build`
Expected: build succeeds for all packages.

- [ ] **Step 3: Full package test (types + unit)**

Run: `pnpm --filter @enkaku/group run test`
Expected: PASS.

- [ ] **Step 4: Commit the bump**

```bash
git add packages/group/package.json
git commit -m "chore(group): release 0.16.2"
```

> **Release gate:** the repo enforces a `minimumReleaseAge` verify gate on the bump commit. Do not attempt to publish before the gate window elapses; the commit above is the release marker, publication follows the repo's normal release flow.

---

## Self-review notes (for the executor)

- **Spec coverage:** API `{ epoch, treeHash }` → Task 1 Step 4. `GroupHandle.treeHash` getter → Task 1 Step 3. Decode/wireformat guards mirroring joinGroupExternal → Task 1 Step 4. Non-goals (no roster, no sig verify) → enforced by the implementation reading only groupContext + JSDoc. All 4 spec test cases (round-trip, advance, malformed, wrong-wireformat) → Task 1 Step 1. Release → Task 2.
- **Type consistency:** `InspectGroupInfoResult` defined and returned in Task 1; `treeHash: Uint8Array` matches the getter's return type. No member/roster type introduced (intentional — see spec Revision note).
- **Watch:** the auto-formatter (Task 1 Step 8) may reorder the index export added in Step 5 — accept its ordering.
