# GroupHandle Member Enumeration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `listMembers()` accessor to `GroupHandle` that enumerates the group's current members (`{ leafIndex, id }`) from the ratchet tree, so a receiver can diff membership before/after a commit.

**Architecture:** Factor the leaf-walk currently inlined in `findMemberLeafIndex` into a private generator `#iterateMembers()`. Both `findMemberLeafIndex` (early-returns on first match) and the new `listMembers()` (collects all) consume it. Pure read over `this.#state.ratchetTree` — no new ts-mls calls, no state mutation.

**Tech Stack:** TypeScript, ts-mls (MLS / RFC 9420), vitest, pnpm. Package: `packages/group` (`@enkaku/group`).

**Spec:** `docs/superpowers/specs/2026-05-28-group-handle-member-enumeration-design.md`

**Conventions (from AGENTS.md — do NOT violate):**
- `type` not `interface`; `Array<T>` not `T[]`; no `any`; `id` not `did` for the value field; `ID`/`HTTP` casing in type names only.
- Use `pnpm`, never `npm`/`npx`. Lint with `rtk proxy pnpm run lint` (not bare `pnpm run lint`).
- Tests live in `packages/group/test/`, imported from `../src/*.js` (note `.js` extension on TS source imports).
- Run commands from `packages/group/`.

---

### Task 1: `GroupMember` type, `#iterateMembers` generator, `listMembers()`, refactor `findMemberLeafIndex`

**Files:**
- Modify: `packages/group/src/credential.ts` (add `GroupMember` type after `MLSCredentialIdentity`, ~line 29)
- Modify: `packages/group/src/group.ts` (import `GroupMember`; add `#iterateMembers` + `listMembers`; refactor `findMemberLeafIndex` at `group.ts:153-172`)
- Modify: `packages/group/src/index.ts` (export `GroupMember` from `./credential.js`)
- Test: `packages/group/test/group.test.ts` (new `describe('GroupHandle.listMembers')` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/group/test/group.test.ts`:

```ts
describe('GroupHandle.listMembers', () => {
  test('enumerates all members in ascending leaf-index order', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const charlie = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'list-members')

    await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { newGroup: groupWithBob } = await commitInvite(aliceGroup, bobKP.publicPackage)

    await createInvite({
      group: groupWithBob,
      identity: alice,
      recipientDID: charlie.id,
      permission: 'member',
    })
    const charlieKP = await createKeyPackageBundle(charlie)
    const { newGroup: groupWith3 } = await commitInvite(groupWithBob, charlieKP.publicPackage)

    const members = groupWith3.listMembers()
    expect(members).toHaveLength(3)
    // Ascending leaf-index order, matching findMemberLeafIndex
    expect(members.map((m) => m.leafIndex)).toEqual([0, 1, 2])
    const ids = members.map((m) => m.id)
    expect(ids).toContain(alice.id)
    expect(ids).toContain(bob.id)
    expect(ids).toContain(charlie.id)
    // listMembers agrees with findMemberLeafIndex for every member
    for (const member of members) {
      expect(groupWith3.findMemberLeafIndex(member.id)).toBe(member.leafIndex)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/group && pnpm exec vitest run test/group.test.ts -t 'enumerates all members'`
Expected: FAIL — `groupWith3.listMembers is not a function`.

- [ ] **Step 3: Add the `GroupMember` type**

In `packages/group/src/credential.ts`, after the `MLSCredentialIdentity` type (currently ends at line 29), add:

```ts
export type GroupMember = {
  /** MLS leaf index (ratchet-tree array position / 2, matching findMemberLeafIndex). */
  leafIndex: number
  /** DID parsed from the leaf's MLS credential identity. */
  id: string
}
```

- [ ] **Step 4: Implement the generator, `listMembers`, and refactor `findMemberLeafIndex`**

In `packages/group/src/group.ts`, extend the existing import from `./credential.js` (currently imports `MemberCredential`, `MLSCredentialIdentity`, `parseMLSCredentialIdentity`) to also import `GroupMember`:

```ts
import {
  type GroupMember,
  type MemberCredential,
  type MLSCredentialIdentity,
  parseMLSCredentialIdentity,
} from './credential.js'
```

Replace the current `findMemberLeafIndex` method (`group.ts:153-172`) with the generator + refactored lookup + new accessor:

```ts
  *#iterateMembers(): Generator<GroupMember> {
    const tree = this.#state.ratchetTree
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

  findMemberLeafIndex(id: string): number | undefined {
    const targetNorm = normalizeDID(id)
    for (const member of this.#iterateMembers()) {
      if (normalizeDID(member.id) === targetNorm) return member.leafIndex
    }
    return undefined
  }

  /**
   * Enumerate the group's current members from the ratchet tree, in ascending
   * leaf-index order. Leaves whose credential identity fails to parse are skipped
   * (same tolerance as findMemberLeafIndex). Reflects the handle's current #state
   * — call before and after processMessage to diff a commit's membership change.
   */
  listMembers(): Array<GroupMember> {
    return [...this.#iterateMembers()]
  }
```

Note: `nodeTypes` and `normalizeDID` are already imported in `group.ts` (lines 35 and 6). `MLSCredentialIdentity` stays imported (used elsewhere — `makeMLSCredential` at line 75).

- [ ] **Step 5: Export `GroupMember` from the package index**

In `packages/group/src/index.ts`, extend the `./credential.js` export block (currently lines 16-22) to include the new type:

```ts
export {
  extractPermission,
  type GroupMember,
  type MemberCredential,
  type MLSCredentialIdentity,
  parseMLSCredentialIdentity,
  populateCacheFromCredential,
} from './credential.js'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/group && pnpm exec vitest run test/group.test.ts -t 'enumerates all members'`
Expected: PASS.

- [ ] **Step 7: Run type check (refactor + new export must type-clean)**

Run: `cd packages/group && pnpm run test:types`
Expected: PASS, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/group/src/credential.ts packages/group/src/group.ts packages/group/src/index.ts packages/group/test/group.test.ts
git commit -m "feat(group): add GroupHandle.listMembers enumeration accessor

Factor findMemberLeafIndex's leaf-walk into a shared #iterateMembers
generator; add listMembers() returning Array<GroupMember>. Export
GroupMember from index.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `listMembers` reflects add and remove after `processMessage` (receive-side diff)

This is the spec's core use case: a receiving member diffs membership across a commit. The generator already reads live `#state`, so no new implementation — this test locks in the behaviour.

**Files:**
- Test: `packages/group/test/group.test.ts` (add a test inside the `describe('GroupHandle.listMembers')` block from Task 1)

- [ ] **Step 1: Write the test**

Add inside the `describe('GroupHandle.listMembers', ...)` block:

```ts
  test('reflects add and remove after processMessage on the receiver', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()
    const charlie = randomIdentity()

    // Alice creates, adds Bob. Bob joins via Welcome.
    const { group: aliceGroup } = await createGroup(alice, 'diff-group')
    const { invite: bobInvite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { welcomeMessage: bobWelcome, newGroup: aliceWithBob } = await commitInvite(
      aliceGroup,
      bobKP.publicPackage,
    )
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: bobWelcome,
      keyPackageBundle: bobKP,
      ratchetTree: aliceWithBob.state.ratchetTree,
    })

    // --- ADD: Alice adds Charlie ONCE; Bob receives that same commit and diffs.
    // Alice and Bob must advance along the SAME commit chain, so the add commit
    // Bob processes is the one that produced Alice's aliceWith3 handle.
    await createInvite({
      group: aliceWithBob,
      identity: alice,
      recipientDID: charlie.id,
      permission: 'member',
    })
    const charlieKP = await createKeyPackageBundle(charlie)
    const { commitMessage: addCommit, newGroup: aliceWith3 } = await commitInvite(
      aliceWithBob,
      charlieKP.publicPackage,
    )

    const beforeAdd = new Set(bobGroup.listMembers().map((m) => m.id))
    await bobGroup.processMessage(addCommit)
    const afterAdd = new Set(bobGroup.listMembers().map((m) => m.id))
    const added = [...afterAdd].filter((id) => !beforeAdd.has(id))
    expect(added).toEqual([charlie.id])

    // --- REMOVE: Alice removes Charlie from her epoch-2 handle (same chain Bob
    // is now on); Bob receives that commit and diffs.
    const charlieLeaf = aliceWith3.findMemberLeafIndex(charlie.id)
    expect(charlieLeaf).toBeDefined()
    const { commitMessage: removeCommit } = await removeMember(
      aliceWith3,
      charlieLeaf as number,
    )

    const beforeRemove = new Set(bobGroup.listMembers().map((m) => m.id))
    await bobGroup.processMessage(removeCommit)
    const afterRemove = new Set(bobGroup.listMembers().map((m) => m.id))
    const removed = [...beforeRemove].filter((id) => !afterRemove.has(id))
    expect(removed).toEqual([charlie.id])
  })
```

- [ ] **Step 2: Run the test**

Run: `cd packages/group && pnpm exec vitest run test/group.test.ts -t 'reflects add and remove'`
Expected: PASS (behaviour already provided by Task 1's generator; no new implementation). Both Alice and Bob advance along the single `addCommit` chain, so Bob's `processMessage(removeCommit)` validates against the matching epoch.

- [ ] **Step 3: Commit**

```bash
git add packages/group/test/group.test.ts
git commit -m "test(group): listMembers reflects add/remove after processMessage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `listMembers` skips a leaf with an unparseable credential identity

The generator `continue`s on parse failure (same tolerance as the old `findMemberLeafIndex`). This test corrupts one leaf's credential identity in the live ratchet tree and asserts enumeration skips it instead of throwing.

**Files:**
- Test: `packages/group/test/group.test.ts` (add a test inside the `describe('GroupHandle.listMembers')` block)

- [ ] **Step 1: Add the `nodeTypes` import to the test file**

At the top of `packages/group/test/group.test.ts`, add an import from `ts-mls` (place after the existing imports, before the `describe` blocks):

```ts
import { nodeTypes } from 'ts-mls'
```

- [ ] **Step 2: Write the test**

Add inside the `describe('GroupHandle.listMembers', ...)` block:

```ts
  test('skips a leaf whose credential identity fails to parse', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const { group: aliceGroup } = await createGroup(alice, 'garbage-leaf')
    await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const bobKP = await createKeyPackageBundle(bob)
    const { newGroup: groupWithBob } = await commitInvite(aliceGroup, bobKP.publicPackage)

    expect(groupWithBob.listMembers()).toHaveLength(2)

    // Corrupt one leaf's credential identity to non-JSON bytes.
    const tree = groupWithBob.state.ratchetTree
    const leaf = tree.find(
      (node) => node != null && node.nodeType === nodeTypes.leaf,
    ) as { leaf: { credential: { identity: Uint8Array } } }
    leaf.leaf.credential.identity = new TextEncoder().encode('not-json-garbage')

    // Enumeration tolerates the bad leaf: it is skipped, not thrown.
    const members = groupWithBob.listMembers()
    expect(members).toHaveLength(1)
    expect(() => groupWithBob.listMembers()).not.toThrow()
  })
```

- [ ] **Step 3: Run the test**

Run: `cd packages/group && pnpm exec vitest run test/group.test.ts -t 'fails to parse'`
Expected: PASS (tolerance already provided by Task 1's generator).

- [ ] **Step 4: Run the whole group test file (regression for the `findMemberLeafIndex` refactor)**

Run: `cd packages/group && pnpm exec vitest run test/group.test.ts`
Expected: PASS — all pre-existing `findMemberLeafIndex` tests (e.g. `works with nullified tree entries`, peer4 e2e) still pass after the refactor.

- [ ] **Step 5: Commit**

```bash
git add packages/group/test/group.test.ts
git commit -m "test(group): listMembers skips unparseable credential leaves

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full package verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full package test suite (types + unit)**

Run: `cd packages/group && pnpm run test`
Expected: PASS — `test:types` clean, all `vitest` tests green.

- [ ] **Step 2: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors. Fix any formatting the linter flags, then re-run.

- [ ] **Step 3: Build (confirms type emission + export surface)**

Run: `cd packages/group && pnpm run build`
Expected: PASS — `GroupMember` appears in emitted `lib/` types.

- [ ] **Step 4: Commit any lint/format fixups (if Step 2 changed files)**

```bash
git add -A packages/group
git commit -m "chore(group): lint fixups for listMembers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

If Step 2 made no changes, skip this commit.

---

## Notes for the implementer

- **Leaf-index convention:** the generator yields `i / 2`. Do not change this — `findMemberLeafIndex` already returns `i / 2` and consumers (Kubun) depend on the two agreeing.
- **State-advance timing:** `listMembers()` reads `#state` *after* it is advanced. `processMessage(commit)` advances `#state` and returns `null` for handshakes; `decrypt(commit)` advances `#state` but then throws. Either works for the pre/post diff as long as `#state` is advanced before the second `listMembers()` call.
- **Do not** touch `processMessage`'s signature/return type, add a commit-introspection API, or implement the diff/HLC/store-write logic — those are the consumer's (Kubun) and explicitly out of scope.
- **Cross-repo:** after this lands and `@enkaku/group` is published, Kubun's Phase 2 (`mls-membership-apply-check`, Q2.3/Q2.4) bumps the dependency and consumes `listMembers()`.

## Self-review (completed by plan author)

- **Spec coverage:** `GroupMember` type (Task 1 Step 3), `#iterateMembers` generator (Task 1 Step 4), `findMemberLeafIndex` refactor (Task 1 Step 4), `listMembers()` (Task 1 Step 4), index export (Task 1 Step 5), multi-member enumeration test (Task 1), add/remove reflection test (Task 2), unparseable-leaf skip test (Task 3), regression for `findMemberLeafIndex` (Task 3 Step 4). All spec sections mapped.
- **Placeholders:** none — all steps contain concrete code and exact commands.
- **Type consistency:** `GroupMember = { leafIndex, id }` used identically across credential.ts, group.ts, index.ts, and tests; field is `id` (not `did`) per the resolved decision; `listMembers(): Array<GroupMember>` and `#iterateMembers(): Generator<GroupMember>` signatures match their call sites.
