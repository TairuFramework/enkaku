# `inspectGroupInfo` Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-destructive `inspectGroupInfo(bytes)` to `@enkaku/group` that returns a GroupInfo's epoch and full member roster without joining or mutating state.

**Architecture:** Extract the GroupHandle's private leaf-walk into a module-level `iterateLeaves(tree)` generator shared by `listMembers` and the new inspector. `inspectGroupInfo` decodes the framed MLSMessage(GroupInfo) (reusing `joinGroupExternal`'s guards), pulls the embedded ratchet tree via ts-mls `ratchetTreeFromExtension`, walks its leaves, and reads epoch from `groupContext`. No signature verification — structural read of an already-trusted blob.

**Tech Stack:** TypeScript, ts-mls (MLS primitives), vitest, pnpm.

---

## Background for the implementer

- `@enkaku/group` lives at `packages/group`. Build all packages from repo root with `pnpm run build`; run this package's unit tests with `pnpm --filter @enkaku/group run test:unit` (vitest).
- **Lint:** use `rtk proxy pnpm run lint` from repo root (NOT bare `pnpm run lint`).
- Repo guardrails (from `AGENTS.md`): `type` not `interface`; `Array<T>` not `T[]`; no `any`; `HTTP`/`ID`/`JWT` casing; never edit generated files (`.gen.ts`, `lib/`).
- Key existing code to mirror:
  - `GroupHandle.#iterateMembers` — `packages/group/src/group.ts:154-171` (the leaf-walk being extracted).
  - `joinGroupExternal` decode guards — `packages/group/src/group.ts:688-696`.
  - `readMessageEpoch` — `packages/group/src/group.ts:573-589` (contrast: total/never-throws; the inspector instead throws).
  - `GroupMember` type — `packages/group/src/credential.ts:31-36`, fields `{ leafIndex: number; id: string }`.
  - `exportGroupInfo` — `packages/group/src/group.ts:621-635`.
  - `GroupHandle.epoch` getter — `packages/group/src/group.ts:120-122`.
- ts-mls already exports `ratchetTreeFromExtension(info): RatchetTree | undefined` (confirmed in `node_modules/ts-mls/dist/src/groupInfo.d.ts`). `RatchetTree` is a ts-mls type.
- Spec: `docs/superpowers/specs/2026-06-03-inspect-group-info-design.md`.

---

## Task 1: Extract shared `iterateLeaves` generator (refactor, no behaviour change)

**Files:**
- Modify: `packages/group/src/group.ts` (imports ~line 11-38; `#iterateMembers` at 154-171)

This is a pure refactor. The existing `listMembers`/`findMemberLeafIndex` tests in `packages/group/test/group.test.ts` are the regression guard — they must keep passing unchanged.

- [ ] **Step 1: Confirm the existing member tests pass before touching anything**

Run: `pnpm --filter @enkaku/group run test:unit -- group.test.ts`
Expected: PASS (baseline green before refactor).

- [ ] **Step 2: Add `RatchetTree` to the ts-mls type import**

In the `from 'ts-mls'` import block (`packages/group/src/group.ts:11-38`), add `RatchetTree` as a type import and `ratchetTreeFromExtension` as a value import. After editing, the relevant lines read (keep alphabetical-ish grouping consistent with existing order):

```ts
  type MlsPublicMessage,
  createGroup as mlsCreateGroup,
  joinGroup as mlsJoinGroup,
  joinGroupExternal as mlsJoinGroupExternal,
  mlsMessageDecoder,
  mlsMessageEncoder,
  processMessage as mlsProcessMessage,
  nodeTypes,
  protocolVersions,
  type RatchetTree,
  ratchetTreeFromExtension,
  wireformats,
} from 'ts-mls'
```

(Add only the two new lines — `type RatchetTree` and `ratchetTreeFromExtension` — next to the existing entries; leave all other imports as-is.)

- [ ] **Step 3: Add the module-level `iterateLeaves` generator**

Place it just above the `GroupHandle` class declaration (before the class, after the top-level helpers like `makeMLSCredential`). It is the body lifted verbatim from `#iterateMembers`, now taking the tree as a parameter:

```ts
/**
 * Walk a ratchet tree's leaf nodes, yielding one GroupMember per leaf whose
 * MLS credential identity parses. Leaves with unparseable identities are
 * skipped (tolerant). leafIndex follows the array-position/2 convention shared
 * by findMemberLeafIndex. Shared by GroupHandle.#iterateMembers (walks the
 * live ClientState tree) and inspectGroupInfo (walks a GroupInfo's embedded
 * tree).
 */
function* iterateLeaves(tree: RatchetTree): Generator<GroupMember> {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node != null && node.nodeType === nodeTypes.leaf) {
      const credential = node.leaf.credential
      if ('identity' in credential) {
        let parsed: ReturnType<typeof parseMLSCredentialIdentity>
        try {
          parsed = parseMLSCredentialIdentity(credential.identity)
        } catch {
          continue
        }
        yield { leafIndex: i / 2, id: parsed.id }
      }
    }
  }
}
```

- [ ] **Step 4: Reduce `#iterateMembers` to delegate**

Replace the existing `#iterateMembers` body (`packages/group/src/group.ts:154-171`) with:

```ts
  *#iterateMembers(): Generator<GroupMember> {
    yield* iterateLeaves(this.#state.ratchetTree)
  }
```

- [ ] **Step 5: Type-check + run the member tests to confirm no behaviour change**

Run: `pnpm --filter @enkaku/group run test:types && pnpm --filter @enkaku/group run test:unit -- group.test.ts`
Expected: PASS (same results as Step 1 — refactor preserved behaviour).

- [ ] **Step 6: Commit**

```bash
git add packages/group/src/group.ts
git commit -m "refactor(group): extract shared iterateLeaves generator"
```

---

## Task 2: Implement `inspectGroupInfo` (TDD)

**Files:**
- Create: `packages/group/test/inspect-group-info.test.ts`
- Modify: `packages/group/src/group.ts` (add type + function)
- Modify: `packages/group/src/index.ts` (export)

- [ ] **Step 1: Write the failing test file**

Create `packages/group/test/inspect-group-info.test.ts`:

```ts
import { randomIdentity } from '@enkaku/token'
import { encode, mlsMessageDecoder, mlsMessageEncoder, decode } from 'ts-mls'
import { defaultExtensionTypes } from 'ts-mls'
import { describe, expect, test } from 'vitest'

import {
  commitInvite,
  createGroup,
  createKeyPackageBundle,
  exportGroupInfo,
  inspectGroupInfo,
  joinGroupExternal,
  createInvite,
  processWelcome,
} from '../src/group.js'

describe('inspectGroupInfo', () => {
  test('round-trips epoch and full member set matching listMembers', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    // A creates group, invites B, commits — gives a 2-member group at epoch 1.
    const { group: aliceGroup } = await createGroup(alice, 'inspect-group')
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
    await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: welcomeMessage,
      keyPackageBundle: bobKP,
      ratchetTree: aliceAfterBob.state.ratchetTree,
    })

    const { groupInfo } = await exportGroupInfo({ group: aliceAfterBob })
    const result = inspectGroupInfo(groupInfo)

    expect(result.epoch).toBe(aliceAfterBob.epoch)
    expect(result.members).toEqual(aliceAfterBob.listMembers())
    expect(result.members.length).toBe(2)
  })

  test('throws on malformed bytes', () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    expect(() => inspectGroupInfo(garbage)).toThrow()
  })

  test('throws on wrong wireformat (non-GroupInfo MLS message)', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'inspect-wf-group')
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
    const { group: bobGroup, credential: bobCred } = await processWelcome({
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
    void bobGroup
  })

  test('throws when ratchet-tree extension is absent', async () => {
    const alice = randomIdentity()
    const { group: aliceGroup } = await createGroup(alice, 'inspect-no-tree')
    const { groupInfo } = await exportGroupInfo({ group: aliceGroup })

    // Strip the ratchet_tree extension and re-encode. inspectGroupInfo does not
    // verify the GroupInfo signature, so the re-encoded blob decodes fine but
    // ratchetTreeFromExtension returns undefined → inspector throws.
    const decoded = decode(mlsMessageDecoder, groupInfo)
    if (decoded == null || decoded.wireformat !== 0x0004) {
      // 0x0004 == wireformats.mls_group_info; narrow for type access below.
      throw new Error('test setup: expected a GroupInfo message')
    }
    const stripped = {
      ...decoded,
      groupInfo: {
        ...decoded.groupInfo,
        extensions: decoded.groupInfo.extensions.filter(
          (ext) => ext.extensionType !== defaultExtensionTypes.ratchet_tree,
        ),
      },
    }
    const reencoded = encode(mlsMessageEncoder, stripped)

    expect(() => inspectGroupInfo(reencoded)).toThrow(/missing ratchet tree extension/)
  })
})
```

> Note on the wireformat literal in the strip test: prefer importing `wireformats` from `ts-mls` and comparing `decoded.wireformat !== wireformats.mls_group_info` rather than the raw `0x0004`. If you add that import, update the guard line accordingly. The raw literal is shown only as a fallback; the named constant is the house style.

- [ ] **Step 2: Run the test to confirm it fails for the right reason**

Run: `pnpm --filter @enkaku/group run test:unit -- inspect-group-info.test.ts`
Expected: FAIL — `inspectGroupInfo` is not exported / not a function (import error or "inspectGroupInfo is not a function").

- [ ] **Step 3: Implement `inspectGroupInfo` + `InspectGroupInfoResult`**

In `packages/group/src/group.ts`, add directly after `readMessageEpoch` (ends at line 589):

```ts
export type InspectGroupInfoResult = {
  /** The GroupInfo's epoch, read from its groupContext. */
  epoch: bigint
  /** Full member roster from the embedded ratchet tree, ascending leafIndex.
   *  Same shape and convention as GroupHandle.listMembers. */
  members: Array<GroupMember>
}

/**
 * Non-destructively inspect a framed MLSMessage(GroupInfo) — read its epoch and
 * member roster without joining or mutating any state. Used to confirm an
 * external-resync Commit was canonically accepted (own leaf present at the
 * expected epoch).
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
  const tree = ratchetTreeFromExtension(message.groupInfo)
  if (tree == null) {
    throw new Error('Invalid groupInfo: missing ratchet tree extension')
  }
  return {
    epoch: message.groupInfo.groupContext.epoch,
    members: [...iterateLeaves(tree)],
  }
}
```

- [ ] **Step 4: Export from `index.ts`**

In `packages/group/src/index.ts`, add to the existing `from './group.js'` block (the one spanning lines 29-55) — insert in alphabetical position:

```ts
  inspectGroupInfo,
  type InspectGroupInfoResult,
```

(e.g. between `GroupHandle`/`GroupHandleParams` and the `JoinGroupExternal*` entries, matching the block's ordering.)

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @enkaku/group run test:unit -- inspect-group-info.test.ts`
Expected: PASS (all 4 tests green).

- [ ] **Step 6: Type-check the whole package**

Run: `pnpm --filter @enkaku/group run test:types`
Expected: PASS (no type errors).

- [ ] **Step 7: Lint**

Run: `rtk proxy pnpm run lint`
Expected: clean (formatter may rewrite import ordering — accept its output).

- [ ] **Step 8: Commit**

```bash
git add packages/group/src/group.ts packages/group/src/index.ts packages/group/test/inspect-group-info.test.ts
git commit -m "feat(group): inspectGroupInfo non-destructive GroupInfo reader"
```

---

## Task 3: Version bump + build

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

- **Spec coverage:** Non-goals (no sig verify, no revocation) → enforced by design + JSDoc (Task 2 Step 3). API type/signature → Task 2. Shared leaf-walk → Task 1. All 4 test cases from the spec's Testing section → Task 2 Step 1. Release → Task 3.
- **Type consistency:** `iterateLeaves(tree: RatchetTree): Generator<GroupMember>` defined in Task 1, consumed identically in Task 2. `InspectGroupInfoResult.members: Array<GroupMember>` reuses the existing exported type — no new member type introduced.
- **Watch:** the auto-formatter (Task 2 Step 7) will likely reorder the ts-mls import lines added in Task 1 Step 2 and the index export added in Task 2 Step 4. That is expected — accept the formatter's ordering rather than fighting it.
