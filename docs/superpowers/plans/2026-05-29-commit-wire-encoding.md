# Commit/Welcome Wire Encoding + Epoch Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@enkaku/group` Commit and Welcome outputs wire-ready (`Uint8Array`) and epoch-tagged so consumers can route them through a Delivery Service to all group members.

**Architecture:** `createCommit` (ts-mls) already returns *framed* `commit: MlsFramedMessage` and `welcome: MlsWelcomeMessage | undefined`. Encode each directly with the package-internal `mlsMessageEncoder`. Because the Welcome output changes from the inner `Welcome` object to framed bytes, every receiver entry point that consumed those values (`processWelcome`, `processMessage`, `decrypt`) gains a decode-at-entry path while staying back-compatible with object inputs.

**Tech Stack:** TypeScript, ts-mls (`encode`/`decode`/`mlsMessageEncoder`/`mlsMessageDecoder`/`wireformats` — all already imported in `src/group.ts`), Vitest.

---

## Background facts (verified against code)

- `createCommit` result: `commit: MlsFramedMessage` (a `MlsPrivateMessage` here — neither producer sets `wireAsPublicMessage`), `welcome: MlsWelcomeMessage | undefined`. Both already carry `version` + `wireformat`. No manual framing needed (corrects spec §3.1).
- `mlsJoinGroup` (ts-mls `clientState.d.ts:110`) takes `welcome: Welcome` — the **inner** object, NOT bytes, NOT framed. No internal decode. So `processWelcome` MUST decode framed welcome bytes back to the inner `Welcome` (corrects spec §4 "no change to processWelcome").
- `encrypt` still returns an in-memory `message: unknown` (NOT bytes). So `decrypt`'s object path stays the only one exercised by the public test suite; its bytes path is latent (no public byte producer for application messages). The decode-at-entry is added for symmetry with `processMessage`.
- `decode(mlsMessageDecoder, bytes)` may return `undefined` (see `joinGroupExternal` guard at `group.ts:597-600`). Guard accordingly.
- Only in-repo callers of these result fields are `packages/group/test/group.test.ts`. The kubun consumer (`packages/plugin-p2p/src/groups/manager.ts`) is a separate repo, updated post-publish.

## File structure

- Modify: `packages/group/src/group.ts`
  - `CommitInviteResult` type (`:353-357`) + `commitInvite` return (`:388-392`)
  - `RemoveMemberResult` type (`:465-468`) + `removeMember` return (`:497`)
  - `GroupHandle.processMessage` (`:225-236`)
  - `GroupHandle.decrypt` (`:207-220`)
  - `ProcessWelcomeParams.welcome` (`:403`) + `processWelcome` mlsJoinGroup call (`:430-439`)
- Modify: `packages/group/test/group.test.ts` (ts-mls import line 2 + new tests)
- Modify: `packages/group/package.json` (version)

## Task ordering rationale

Task 1 changes `commitInvite` to emit bytes **and** lands the matching decode paths in `processWelcome`/`processMessage` in the same commit — they are mutually dependent (existing tests feed `welcomeMessage`→`processWelcome` and `commitMessage`→`processMessage`, so flipping the producer without the decoders breaks them). Tasks 2–5 build on that green baseline.

---

### Task 1: Bytes + epoch on `commitInvite`; decode-at-entry on `processWelcome` and `processMessage`

**Files:**
- Modify: `packages/group/src/group.ts` (`CommitInviteResult` `:353-357`, `commitInvite` `:388-392`, `processWelcome` `:403`+`:430-439`, `processMessage` `:225-236`)
- Test: `packages/group/test/group.test.ts`

- [ ] **Step 1: Add ts-mls decode helpers to the test import**

In `packages/group/test/group.test.ts`, change line 2 from:

```ts
import { type NodeLeaf, nodeTypes } from 'ts-mls'
```

to:

```ts
import { type NodeLeaf, decode, mlsMessageDecoder, nodeTypes, wireformats } from 'ts-mls'
```

- [ ] **Step 2: Write the failing test**

Append inside the `describe('GroupHandle lifecycle', …)` block (before its closing `})` at `:698`):

```ts
test('commitInvite returns wire bytes + epoch; receiver joins and processes via bytes', async () => {
  const alice = randomIdentity()
  const bob = randomIdentity()
  const charlie = randomIdentity()

  const { group: aliceGroup } = await createGroup(alice, 'wire-add')
  const { invite: bobInvite } = await createInvite({
    group: aliceGroup,
    identity: alice,
    recipientDID: bob.id,
    permission: 'member',
  })
  const bobKP = await createKeyPackageBundle(bob)
  const addBob = await commitInvite(aliceGroup, bobKP.publicPackage)

  // Wire-ready bytes + epoch contract.
  expect(addBob.commitMessage).toBeInstanceOf(Uint8Array)
  expect(addBob.welcomeMessage).toBeInstanceOf(Uint8Array)
  expect(addBob.epoch).toBe(addBob.newGroup.epoch)
  expect(addBob.epoch).toBe(1n)

  // Bytes decode back to framed MLSMessages of the expected wireformat.
  const decodedCommit = decode(mlsMessageDecoder, addBob.commitMessage)
  expect(decodedCommit?.wireformat).toBe(wireformats.mls_private_message)
  const decodedWelcome = decode(mlsMessageDecoder, addBob.welcomeMessage)
  expect(decodedWelcome?.wireformat).toBe(wireformats.mls_welcome)

  // Bob joins using welcome BYTES (processWelcome decode path).
  const { group: bobGroup } = await processWelcome({
    identity: bob,
    invite: bobInvite,
    welcome: addBob.welcomeMessage,
    keyPackageBundle: bobKP,
    ratchetTree: addBob.newGroup.state.ratchetTree,
  })
  expect(bobGroup.epoch).toBe(1n)

  // Alice adds Charlie; Bob applies the add commit as BYTES (processMessage decode path).
  await createInvite({
    group: addBob.newGroup,
    identity: alice,
    recipientDID: charlie.id,
    permission: 'member',
  })
  const charlieKP = await createKeyPackageBundle(charlie)
  const addCharlie = await commitInvite(addBob.newGroup, charlieKP.publicPackage)
  expect(addCharlie.commitMessage).toBeInstanceOf(Uint8Array)

  await bobGroup.processMessage(addCharlie.commitMessage)
  expect(bobGroup.epoch).toBe(2n)
  expect(bobGroup.findMemberLeafIndex(charlie.id)).toBeDefined()
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @enkaku/group exec vitest run -t 'commitInvite returns wire bytes'`
Expected: FAIL — `expect(addBob.commitMessage).toBeInstanceOf(Uint8Array)` fails (currently the unframed object).

- [ ] **Step 4: Change `CommitInviteResult` to bytes + epoch**

In `packages/group/src/group.ts`, replace the type at `:353-357`:

```ts
export type CommitInviteResult = {
  commitMessage: unknown
  welcomeMessage: unknown
  newGroup: GroupHandle
}
```

with:

```ts
export type CommitInviteResult = {
  /** Framed MLSMessage bytes. Broadcast to existing members via the DS. */
  commitMessage: Uint8Array
  /** Framed MLSMessage(Welcome) bytes. Delivered to the new member. */
  welcomeMessage: Uint8Array
  newGroup: GroupHandle
  /** Epoch the commit was committed into (== newGroup.epoch). */
  epoch: bigint
}
```

- [ ] **Step 5: Encode the outputs in `commitInvite`**

In `packages/group/src/group.ts`, replace the return block at `:388-392`:

```ts
  return {
    commitMessage: result.commit,
    welcomeMessage: result.welcome?.welcome,
    newGroup,
  }
```

with:

```ts
  if (result.welcome == null) {
    throw new Error('commitInvite: expected a Welcome message for the add proposal')
  }
  return {
    commitMessage: encode(mlsMessageEncoder, result.commit),
    welcomeMessage: encode(mlsMessageEncoder, result.welcome),
    newGroup,
    epoch: newGroup.epoch,
  }
```

- [ ] **Step 6: Decode framed welcome bytes in `processWelcome`**

In `packages/group/src/group.ts`, change the `ProcessWelcomeParams.welcome` field at `:403` from:

```ts
  welcome: unknown
```

to:

```ts
  welcome: Uint8Array | unknown
```

Then in `processWelcome`, immediately before the `const sanitizedTree = …` line (`:430`), insert:

```ts
  let resolvedWelcome: unknown = welcome
  if (welcome instanceof Uint8Array) {
    const decoded = decode(mlsMessageDecoder, welcome)
    if (decoded == null || decoded.wireformat !== wireformats.mls_welcome) {
      throw new Error('processWelcome: expected a framed MLSMessage(Welcome)')
    }
    resolvedWelcome = decoded.welcome
  }
```

and change the `welcome` argument passed to `mlsJoinGroup` at `:433` from:

```ts
    welcome: welcome as JoinGroupParams['welcome'],
```

to:

```ts
    welcome: resolvedWelcome as JoinGroupParams['welcome'],
```

- [ ] **Step 7: Decode framed bytes in `processMessage`**

In `packages/group/src/group.ts`, replace the method body at `:225-236`:

```ts
  async processMessage(privateMessage: unknown): Promise<Uint8Array | null> {
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: privateMessage as Parameters<typeof mlsProcessMessage>[0]['message'],
    })
    this.#state = result.newState
    if (result.kind === 'applicationMessage') {
      return result.message
    }
    return null
  }
```

with:

```ts
  async processMessage(message: Uint8Array | unknown): Promise<Uint8Array | null> {
    let decoded: unknown = message
    if (message instanceof Uint8Array) {
      const parsed = decode(mlsMessageDecoder, message)
      if (parsed == null) {
        throw new Error('processMessage: failed to decode MLSMessage')
      }
      decoded = parsed
    }
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: decoded as Parameters<typeof mlsProcessMessage>[0]['message'],
    })
    this.#state = result.newState
    if (result.kind === 'applicationMessage') {
      return result.message
    }
    return null
  }
```

- [ ] **Step 8: Run the new test + full group suite to verify green**

Run: `pnpm --filter @enkaku/group exec vitest run`
Expected: PASS — new test passes; pre-existing tests that feed `welcomeMessage`→`processWelcome` (`:631`, `:728`, `:756`, `:788`) and `commitMessage`→`processMessage` (`:652`) now exercise the bytes paths and still pass.

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @enkaku/group run build:types` (or `pnpm run build` from repo root if no per-package script)
Expected: no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/group/src/group.ts packages/group/test/group.test.ts
git commit -m "feat(group): wire-ready bytes + epoch on commitInvite; decode-at-entry for welcome/commit"
```

---

### Task 2: Bytes + epoch on `removeMember`

**Files:**
- Modify: `packages/group/src/group.ts` (`RemoveMemberResult` `:465-468`, `removeMember` return `:497`)
- Test: `packages/group/test/group.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('GroupHandle lifecycle', …)` block (before its closing `})`):

```ts
test('removeMember returns commit bytes + epoch; receiver applies via bytes', async () => {
  const alice = randomIdentity()
  const bob = randomIdentity()
  const charlie = randomIdentity()

  // alice + bob + charlie group, with bob joined so he can receive the remove commit.
  const { group: aliceGroup } = await createGroup(alice, 'wire-remove')
  const { invite: bobInvite } = await createInvite({
    group: aliceGroup,
    identity: alice,
    recipientDID: bob.id,
    permission: 'member',
  })
  const bobKP = await createKeyPackageBundle(bob)
  const addBob = await commitInvite(aliceGroup, bobKP.publicPackage)
  const { group: bobGroup } = await processWelcome({
    identity: bob,
    invite: bobInvite,
    welcome: addBob.welcomeMessage,
    keyPackageBundle: bobKP,
    ratchetTree: addBob.newGroup.state.ratchetTree,
  })

  await createInvite({
    group: addBob.newGroup,
    identity: alice,
    recipientDID: charlie.id,
    permission: 'member',
  })
  const charlieKP = await createKeyPackageBundle(charlie)
  const addCharlie = await commitInvite(addBob.newGroup, charlieKP.publicPackage)
  await bobGroup.processMessage(addCharlie.commitMessage)

  const charlieLeaf = addCharlie.newGroup.findMemberLeafIndex(charlie.id)
  expect(charlieLeaf).toBeDefined()
  const removeRes = await removeMember(addCharlie.newGroup, charlieLeaf as number)

  expect(removeRes.commitMessage).toBeInstanceOf(Uint8Array)
  expect(removeRes.epoch).toBe(removeRes.newGroup.epoch)
  const decoded = decode(mlsMessageDecoder, removeRes.commitMessage)
  expect(decoded?.wireformat).toBe(wireformats.mls_private_message)

  await bobGroup.processMessage(removeRes.commitMessage)
  expect(bobGroup.findMemberLeafIndex(charlie.id)).toBeUndefined()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @enkaku/group exec vitest run -t 'removeMember returns commit bytes'`
Expected: FAIL — `expect(removeRes.commitMessage).toBeInstanceOf(Uint8Array)` fails (currently the unframed object).

- [ ] **Step 3: Change `RemoveMemberResult` to bytes + epoch**

In `packages/group/src/group.ts`, replace the type at `:465-468`:

```ts
export type RemoveMemberResult = {
  commitMessage: unknown
  newGroup: GroupHandle
}
```

with:

```ts
export type RemoveMemberResult = {
  /** Framed MLSMessage bytes. Broadcast to existing members via the DS. */
  commitMessage: Uint8Array
  newGroup: GroupHandle
  /** Epoch the commit was committed into (== newGroup.epoch). */
  epoch: bigint
}
```

- [ ] **Step 4: Encode the output in `removeMember`**

In `packages/group/src/group.ts`, replace the return at `:497`:

```ts
  return { commitMessage: result.commit, newGroup }
```

with:

```ts
  return {
    commitMessage: encode(mlsMessageEncoder, result.commit),
    newGroup,
    epoch: newGroup.epoch,
  }
```

- [ ] **Step 5: Run the new test + full group suite**

Run: `pnpm --filter @enkaku/group exec vitest run`
Expected: PASS — new test passes; pre-existing remove test (`:661`/`:664`) now exercises the bytes path and still passes.

- [ ] **Step 6: Commit**

```bash
git add packages/group/src/group.ts packages/group/test/group.test.ts
git commit -m "feat(group): wire-ready bytes + epoch on removeMember"
```

---

### Task 3: `decrypt` accepts bytes (symmetry)

**Files:**
- Modify: `packages/group/src/group.ts` (`GroupHandle.decrypt` `:207-220`)

**Note:** `encrypt` still returns an in-memory `message: unknown`, so there is no public producer of application-message bytes; the bytes branch is latent and not exercisable through the public test API (would require exporting the encoder — out of scope). The object branch stays covered by the existing peer4 test (`:734`). This task widens the type and adds the decode branch for parity with `processMessage`.

- [ ] **Step 1: Add the decode-at-entry branch to `decrypt`**

In `packages/group/src/group.ts`, replace the method body at `:207-220`:

```ts
  async decrypt(privateMessage: unknown): Promise<Uint8Array> {
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: privateMessage as Parameters<typeof mlsProcessMessage>[0]['message'],
    })
    if (result.kind === 'applicationMessage') {
      this.#state = result.newState
      return result.message
    }
    // Commit or proposal — state was updated
    this.#state = result.newState
    throw new Error('Expected application message but received handshake message')
  }
```

with:

```ts
  async decrypt(message: Uint8Array | unknown): Promise<Uint8Array> {
    let decoded: unknown = message
    if (message instanceof Uint8Array) {
      const parsed = decode(mlsMessageDecoder, message)
      if (parsed == null) {
        throw new Error('decrypt: failed to decode MLSMessage')
      }
      decoded = parsed
    }
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: decoded as Parameters<typeof mlsProcessMessage>[0]['message'],
    })
    if (result.kind === 'applicationMessage') {
      this.#state = result.newState
      return result.message
    }
    // Commit or proposal — state was updated
    this.#state = result.newState
    throw new Error('Expected application message but received handshake message')
  }
```

- [ ] **Step 2: Run the full group suite (object path still works)**

Run: `pnpm --filter @enkaku/group exec vitest run`
Expected: PASS — the existing `decrypt(message)` object-path test (`:734`) still passes.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @enkaku/group run build:types`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/group/src/group.ts
git commit -m "feat(group): decrypt accepts framed bytes for symmetry with processMessage"
```

---

### Task 4: Stale-epoch rejection holds for the bytes form

**Files:**
- Test: `packages/group/test/group.test.ts`

This covers spec §6 bullet 4: a receiver already past a commit's epoch rejects the stale commit bytes. No production code change — `mlsProcessMessage` rejects wrong-epoch handshakes; this test asserts the behaviour survives the decode-at-entry path.

- [ ] **Step 1: Write the test**

Append inside the `describe('GroupHandle lifecycle', …)` block (before its closing `})`):

```ts
test('processMessage rejects a stale commit (bytes form) on a receiver past that epoch', async () => {
  const alice = randomIdentity()
  const bob = randomIdentity()
  const charlie = randomIdentity()
  const dave = randomIdentity()

  const { group: aliceGroup } = await createGroup(alice, 'wire-stale')
  const { invite: bobInvite } = await createInvite({
    group: aliceGroup,
    identity: alice,
    recipientDID: bob.id,
    permission: 'member',
  })
  const bobKP = await createKeyPackageBundle(bob)
  const addBob = await commitInvite(aliceGroup, bobKP.publicPackage)
  const { group: bobGroup } = await processWelcome({
    identity: bob,
    invite: bobInvite,
    welcome: addBob.welcomeMessage,
    keyPackageBundle: bobKP,
    ratchetTree: addBob.newGroup.state.ratchetTree,
  })

  // Alice produces an add commit at epoch 1->2 (the "stale" one Bob will apply first).
  await createInvite({
    group: addBob.newGroup,
    identity: alice,
    recipientDID: charlie.id,
    permission: 'member',
  })
  const charlieKP = await createKeyPackageBundle(charlie)
  const addCharlie = await commitInvite(addBob.newGroup, charlieKP.publicPackage)

  // Bob applies it, advancing to epoch 2.
  await bobGroup.processMessage(addCharlie.commitMessage)
  expect(bobGroup.epoch).toBe(2n)

  // Re-applying the same epoch-1->2 commit bytes must be rejected (Bob is now at epoch 2).
  await expect(bobGroup.processMessage(addCharlie.commitMessage)).rejects.toThrow()
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @enkaku/group exec vitest run -t 'processMessage rejects a stale commit'`
Expected: PASS — the re-applied stale commit bytes are rejected by ts-mls.

- [ ] **Step 3: Commit**

```bash
git add packages/group/test/group.test.ts
git commit -m "test(group): stale commit bytes rejected on a receiver past that epoch"
```

---

### Task 5: Version bump to 0.16.1

**Files:**
- Modify: `packages/group/package.json` (version field)

**Note:** breaking change at the type level (`unknown` → `Uint8Array`) is accepted as a patch per the user. No enkaku-side `pnpm-workspace.yaml` catalog entry for `@enkaku/group` exists and no in-repo package consumes it, so there is nothing to bump beyond `package.json`. The kubun-side catalog bump is out of scope here.

- [ ] **Step 1: Bump the version**

In `packages/group/package.json`, change:

```json
"version": "0.16.0",
```

to:

```json
"version": "0.16.1",
```

- [ ] **Step 2: Run the full package build + test once more**

Run: `pnpm --filter @enkaku/group run build && pnpm --filter @enkaku/group exec vitest run`
Expected: clean build, all tests pass.

- [ ] **Step 3: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors (this repo requires `rtk proxy` in front of the lint command).

- [ ] **Step 4: Commit**

```bash
git add packages/group/package.json
git commit -m "chore(group): release 0.16.1"
```

---

## Self-review

**Spec coverage:**
- §3.1 wire bytes on commit/welcome → Tasks 1 (commitInvite) + 2 (removeMember). Framing corrected: encode `result.commit`/`result.welcome` directly (already framed).
- §3.1 `epoch` field → Tasks 1 + 2.
- §3.2 `processMessage` bytes → Task 1, step 7.
- §3.2 `decrypt` bytes → Task 3.
- §4 (claimed) "no change to processWelcome" → **corrected**: `processWelcome` MUST decode framed welcome bytes (Task 1, step 6), because `mlsJoinGroup` takes the inner `Welcome`, not bytes.
- §5 version → Task 5 (0.16.1 per user, not 0.17.0; no enkaku catalog to bump).
- §6 tests: bytes round-trip + epoch (Tasks 1, 2), `processMessage(bytes)` advances epoch (Task 1), stale-bytes rejection (Task 4).

**Type consistency:** `commitMessage`/`welcomeMessage`: `Uint8Array`; `epoch`: `bigint`; `processMessage`/`decrypt`/`ProcessWelcomeParams.welcome` params: `Uint8Array | unknown`. Consistent across tasks.

**Placeholder scan:** none — every code/command/expected-output is concrete.
