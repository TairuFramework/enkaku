# Custom GroupContext extension support for kubun — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `@enkaku/group` consumers (kubun) create joinable groups carrying a custom GroupContext extension and reject commits that mutate it.

**Architecture:** Two plumbing changes to `@enkaku/group`, both surfacing ts-mls primitives enkaku already imports but does not wire through. Gap 1: pass leaf `capabilities` to `generateKeyPackageWithKey` (auto-derived at `createGroup`, explicit at `createKeyPackageBundle`). Gap 2: thread a raw ts-mls `IncomingMessageCallback` commit policy through `GroupHandle.processMessage`/`decrypt`, throwing `CommitRejectedError` on reject. Commit-reject atomicity is native (ts-mls returns the pre-commit state).

**Tech Stack:** TypeScript, ts-mls (RFC 9420 MLS), vitest, pnpm.

## Global Constraints

- Type definitions use `type`, never `interface`.
- Names: `ID` not `Id`, `DID`, `MLS`, `JWT` — no lowercase abbreviations.
- `Array<T>`, never `T[]`.
- No `any` — use `unknown` / specific types.
- `pnpm` only, never `npm`/`npx`.
- Do not edit generated files (`lib/`, `*.gen.ts`).
- Lint via `rtk proxy pnpm run lint` (not bare `pnpm run lint`).
- Default behavior for groups with no custom extension and no commit policy must be byte-for-byte preserved.

## Spec reference

`docs/superpowers/specs/2026-06-17-kubun-groupcontext-extension-support-design.md`

## Key code facts (verified)

- ts-mls `generateKeyPackageWithKey({ ..., capabilities? })` — `keyPackage.d.ts:46`.
- ts-mls `processMessage({ ..., callback? })`; `callback: IncomingMessageCallback` returns `"accept" | "reject"` — `processMessages.d.ts:47-52`.
- Callback arg for a commit: `{ kind: "commit", senderLeafIndex: LeafIndex | undefined, proposals: ProposalWithSender[] }` — `incomingMessageAction.d.ts:6-13`.
- On reject, ts-mls `processCommit` returns `{ newState: state, actionTaken: "reject", ... }` (pre-commit state) — `processMessages.js:159`.
- `ProcessMessageResult` carries `actionTaken: IncomingMessageAction` on its `"newState"` variant — `processMessages.d.ts:8-12`.
- `extensionsSupportedByCapabilities` filters out default extension types, then requires the rest be in `capabilities.extensions` — `extension.js:104-108`. So only NON-default extension types must be advertised; advertising extras is harmless.
- `defaultCapabilities().extensions` is `[]` (plus grease) — `defaultCapabilities.js`.
- Every `GroupContextExtension` carries `extensionType: number` — `extension.d.ts:8-12`.
- `group_context_extensions` proposal type value is `7`; `defaultProposalTypes` exported from ts-mls — `defaultProposalType.d.ts`.
- ts-mls index exports: `defaultCapabilities`, `type Capabilities`, `type IncomingMessageCallback`, `type ProposalWithSender`, `defaultProposalTypes`, `makeCustomExtension` — `index.d.ts:10-33`.

## File structure

- `packages/group/src/types.ts` — add `capabilities?` and `commitPolicy?` to `GroupOptions`.
- `packages/group/src/group.ts` — leaf-capability build at `createGroup`/`createKeyPackageBundle`; `CommitRejectedError`; `#commitPolicy` on `GroupHandle`; policy in `processMessage`/`decrypt`; thread `commitPolicy` through `createGroup`/`restoreGroup`/`processWelcome`.
- `packages/group/src/index.ts` — re-export `IncomingMessageCallback`, `ProposalWithSender`, `CommitRejectedError`.
- `packages/group/test/groupcontext-extension.test.ts` — new test file for both gaps.

---

### Task 1: Gap 1 — leaf-node capabilities for custom extensions

**Files:**
- Modify: `packages/group/src/types.ts` (add `capabilities?` to `GroupOptions`)
- Modify: `packages/group/src/group.ts` (`createGroup` ~292-303, `createKeyPackageBundle` ~640-644, ts-mls import block 17-38)
- Test: `packages/group/test/groupcontext-extension.test.ts`

**Interfaces:**
- Consumes: existing `createGroup(identity, groupID, options?)`, `createKeyPackageBundle(identity, options?)`, `commitInvite`, `processWelcome`, `createInvite` (unchanged signatures).
- Produces:
  - `GroupOptions.capabilities?: Capabilities` (ts-mls type).
  - `createGroup` leaf advertises every non-default GroupContext extension type from `options.extensions` unless `options.capabilities` overrides.
  - `createKeyPackageBundle` leaf advertises `options?.capabilities ?? defaultCapabilities()`.

- [ ] **Step 1: Write the failing test**

Create `packages/group/test/groupcontext-extension.test.ts`:

```ts
import { createIdentity, randomIdentity } from '@enkaku/token'
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

function readAnchor(extensions: ReadonlyArray<{ extensionType: number; extensionData: Uint8Array }>) {
  const ext = extensions.find((e) => e.extensionType === ANCHOR_TYPE)
  return ext == null ? undefined : new TextDecoder().decode(ext.extensionData)
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
    const { welcomeMessage, commitMessage } = await commitInvite({
      group: aliceGroup,
      identity: alice,
      invite,
      keyPackage: bobBundle.publicPackage,
    })
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
    const { welcomeMessage } = await commitInvite({
      group: aliceGroup,
      identity: alice,
      invite,
      keyPackage: bobBundle.publicPackage,
    })
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
    })
    expect(bobGroup.memberCount).toBe(2)
  })
})
```

> Note: confirm `commitInvite`'s exact param names against `group.ts:403` (`createInvite`/`commitInvite` blocks). If `commitInvite` takes the invitee KeyPackage under a different key than `keyPackage`, adjust the call; the test intent (invite + admit Bob whose bundle advertises `ANCHOR_TYPE`) is unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/group && pnpm exec vitest run test/groupcontext-extension.test.ts -t "anchored group"`
Expected: FAIL — `ValidationError: Added leaf node that doesn't support extension in GroupContext` thrown from `commitInvite`.

- [ ] **Step 3: Add `capabilities` to `GroupOptions`**

In `packages/group/src/types.ts`, change the ts-mls import (line 2) and add the field:

```ts
import type {
  Capabilities,
  CryptoProvider,
  GroupContextExtension,
  KeyPackage,
  PrivateKeyPackage,
} from 'ts-mls'
```

Add inside `GroupOptions` (after the `extensions` field, ~line 12):

```ts
  /**
   * Raw ts-mls leaf-node capabilities. At createGroup, overrides the
   * auto-derived capabilities; at createKeyPackageBundle, sets the invitee
   * leaf's capabilities (default: defaultCapabilities()).
   */
  capabilities?: Capabilities
```

- [ ] **Step 4: Build leaf capabilities in `group.ts`**

In `packages/group/src/group.ts`, add to the ts-mls import block (lines 17-38) these names (keep the block's existing ordering style): `defaultCapabilities`, `type Capabilities`, and `type GroupContextExtension`.

Add a helper above `createGroup` (before line 284):

```ts
/**
 * Build the leaf-node capabilities for a group creator. RFC 9420 requires a
 * member's leaf to advertise every non-default GroupContext extension type the
 * group uses; we derive that set from the group's extensions so it cannot
 * desync. An explicit `override` (GroupOptions.capabilities) wins verbatim.
 */
function buildCreatorCapabilities(
  extensions: ReadonlyArray<GroupContextExtension>,
  override?: Capabilities,
): Capabilities {
  if (override != null) return override
  const base = defaultCapabilities()
  const types = new Set<number>([...base.extensions, ...extensions.map((e) => e.extensionType)])
  return { ...base, extensions: [...types] }
}
```

In `createGroup`, pass the capabilities to `generateKeyPackageWithKey` (replace the call at lines 292-296):

```ts
  const extensions = options?.extensions ?? []
  const statePromise = generateKeyPackageWithKey({
    credential: makeMLSCredential(identity),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite: context.cipherSuite,
    capabilities: buildCreatorCapabilities(extensions, options?.capabilities),
  }).then((keyPackage) => {
    return mlsCreateGroup({
      context,
      groupId: new TextEncoder().encode(groupID),
      keyPackage: keyPackage.publicPackage,
      privateKeyPackage: keyPackage.privatePackage,
      extensions,
    })
  })
```

In `createKeyPackageBundle`, pass the explicit capabilities (replace the call at lines 640-644):

```ts
  const result = await generateKeyPackageWithKey({
    credential: makeMLSCredential(identity),
    signatureKeyPair: { signKey: identity.privateKey, publicKey: identity.publicKey },
    cipherSuite,
    capabilities: options?.capabilities ?? defaultCapabilities(),
  })
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/group && pnpm exec vitest run test/groupcontext-extension.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Run the full package test + typecheck**

Run: `cd packages/group && pnpm exec vitest run && pnpm run build:types`
Expected: PASS — no regression in `group.test.ts` / `external-rejoin.test.ts`.

- [ ] **Step 7: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/group/src/types.ts packages/group/src/group.ts packages/group/test/groupcontext-extension.test.ts
git commit -m "feat(group): plumb leaf capabilities for custom GroupContext extensions

Auto-derive at createGroup from options.extensions; explicit
capabilities at createKeyPackageBundle. Fixes un-joinable anchored
groups (Gap 1).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Gap 2 — commit policy hook with atomic reject

**Files:**
- Modify: `packages/group/src/types.ts` (add `commitPolicy?` to `GroupOptions`)
- Modify: `packages/group/src/group.ts` (`CommitRejectedError`; `GroupHandleParams`/`GroupHandle` `#commitPolicy`; `processMessage` 250-269; `decrypt` 218-239; construction sites `createGroup` ~318, `restoreGroup` ~339, `processWelcome` ~505; ts-mls import block)
- Modify: `packages/group/src/index.ts` (re-exports)
- Test: `packages/group/test/groupcontext-extension.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `GroupOptions` (now with `capabilities`), `GroupHandle`, `createGroup`/`restoreGroup`/`processWelcome` from Task 1.
- Produces:
  - `GroupOptions.commitPolicy?: IncomingMessageCallback` (ts-mls type).
  - `GroupHandle.processMessage(message, opts?: { commitPolicy?: IncomingMessageCallback })` and `decrypt(message, opts?: { commitPolicy?: IncomingMessageCallback })`. Per-call `commitPolicy` overrides the per-handle default.
  - `CommitRejectedError extends Error` with `proposals: Array<ProposalWithSender>` and `senderLeafIndex?: number`, thrown when the policy rejects a commit. Handle stays at pre-commit epoch.
  - Re-exports: `IncomingMessageCallback`, `ProposalWithSender`, `CommitRejectedError`.

- [ ] **Step 1: Write the failing test**

Append to `packages/group/test/groupcontext-extension.test.ts`. Add imports at the top of the file:

```ts
import { defaultProposalTypes } from 'ts-mls'
import type { IncomingMessageCallback } from 'ts-mls'
import { CommitRejectedError } from '../src/group.js'
import { GroupHandle } from '../src/group.js'
```

Then add:

```ts
// Reject any commit that carries a group_context_extensions proposal touching
// the anchor type — kubun's immutability policy, expressed as a raw callback.
const rejectAnchorMutation: IncomingMessageCallback = (incoming) => {
  if (incoming.kind === 'commit') {
    for (const { proposal } of incoming.proposals) {
      if (
        proposal.proposalType === defaultProposalTypes.group_context_extensions &&
        proposal.group_context_extensions.extensions.some((e) => e.extensionType === ANCHOR_TYPE)
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
    const { commitMessage, welcomeMessage } = await commitInvite({
      group: aliceGroup,
      identity: alice,
      invite,
      keyPackage: bobBundle.publicPackage,
    })
    // Bob joins with the same policy seeded.
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
      options: { commitPolicy: rejectAnchorMutation },
    })
    // Bob applies Alice's add-commit normally (no anchor mutation).
    await bobGroup.processMessage(commitMessage)
    const epochBefore = bobGroup.epoch

    // Alice proposes+commits a group_context_extensions change rewriting the anchor.
    const mutatingCommit = await aliceGroup.commitGroupContextExtensions({
      extensions: [anchorExtension(bob.id)],
    })

    // Bob's policy rejects it; epoch unchanged.
    await expect(bobGroup.processMessage(mutatingCommit)).rejects.toBeInstanceOf(CommitRejectedError)
    expect(bobGroup.epoch).toBe(epochBefore)
  })

  test('normal Add/Remove/Update commit is unaffected by the policy', async () => {
    // Reuses the plain flow: a policy that rejects anchor mutations must not
    // reject an ordinary add commit.
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
    const { commitMessage, welcomeMessage } = await commitInvite({
      group: aliceGroup,
      identity: alice,
      invite: bobInvite,
      keyPackage: bobBundle.publicPackage,
    })
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite: bobInvite,
      welcome: welcomeMessage,
      keyPackageBundle: bobBundle,
      options: { commitPolicy: rejectAnchorMutation },
    })
    // The add-commit applies cleanly under the policy (no throw).
    await expect(bobGroup.processMessage(commitMessage)).resolves.toBeNull()
    expect(bobGroup.memberCount).toBe(2)
  })

  test('per-call commitPolicy overrides the per-handle default', async () => {
    const alice = randomIdentity()
    // Handle default accepts everything; per-call policy rejects all commits.
    const { group } = await createGroup(alice, 'g2-override')
    const rejectAll: IncomingMessageCallback = () => 'reject'
    // A self-update commit produced by Alice, applied to her own handle would
    // normally advance; with the per-call reject it must throw and not advance.
    const epochBefore = group.epoch
    const selfCommit = await group.commitSelfUpdate()
    await expect(
      group.processMessage(selfCommit, { commitPolicy: rejectAll }),
    ).rejects.toBeInstanceOf(CommitRejectedError)
    expect(group.epoch).toBe(epochBefore)
  })
})
```

> Note: this test references two helpers that may not exist yet —
> `GroupHandle.commitGroupContextExtensions(...)` and `commitSelfUpdate()`. If
> `@enkaku/group` already exposes a way to produce a `group_context_extensions`
> commit and a self-update commit, use those exact APIs instead and delete these
> placeholders. If it does NOT, the policy-hook behavior can still be tested
> without them: construct the mutating/self-update commit directly via ts-mls
> `createCommit({ context, state, extraProposals: [...] })` against
> `aliceGroup.state`/`aliceGroup.context` and frame it with `mlsMessageEncoder`,
> exactly as `commitInvite` does at `group.ts:403-437`. Do NOT add new public
> commit helpers to `@enkaku/group` as part of this task — keep Task 2 scoped to
> the policy hook. Building the ts-mls commit inline in the test is the intended
> path; the helper names above are illustrative shorthand only.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/group && pnpm exec vitest run test/groupcontext-extension.test.ts -t "Gap 2"`
Expected: FAIL — `CommitRejectedError` is not exported / `processMessage` does not accept a policy and does not throw.

- [ ] **Step 3: Add `commitPolicy` to `GroupOptions`**

In `packages/group/src/types.ts`, extend the ts-mls import to include `IncomingMessageCallback` and add the field to `GroupOptions` (after `capabilities`):

```ts
import type {
  Capabilities,
  CryptoProvider,
  GroupContextExtension,
  IncomingMessageCallback,
  KeyPackage,
  PrivateKeyPackage,
} from 'ts-mls'
```

```ts
  /**
   * Default commit policy for the resulting GroupHandle. Invoked during
   * processMessage/decrypt for each incoming commit; return 'reject' to refuse
   * a commit (the handle stays at its pre-commit epoch and processMessage
   * throws CommitRejectedError). Overridable per call.
   */
  commitPolicy?: IncomingMessageCallback
```

- [ ] **Step 4: Add `CommitRejectedError` and the import names in `group.ts`**

Extend the ts-mls import block (lines 17-38) with: `type IncomingMessageCallback`, `type ProposalWithSender`. Then add, near the top of `group.ts` (after the imports, before `GroupHandleParams`):

```ts
/**
 * Thrown by GroupHandle.processMessage/decrypt when the active commit policy
 * rejects an incoming commit. The handle is left at its pre-commit epoch.
 */
export class CommitRejectedError extends Error {
  readonly proposals: Array<ProposalWithSender>
  readonly senderLeafIndex?: number

  constructor(proposals: Array<ProposalWithSender>, senderLeafIndex?: number) {
    super('Commit rejected by group commit policy')
    this.name = 'CommitRejectedError'
    this.proposals = proposals
    this.senderLeafIndex = senderLeafIndex
  }
}
```

- [ ] **Step 5: Store the policy on `GroupHandle`**

In `GroupHandleParams` (lines 86-94), add:

```ts
  /** Default commit policy applied by processMessage/decrypt. */
  commitPolicy?: IncomingMessageCallback
```

In `GroupHandle`, add the field and assign it in the constructor:

```ts
  #commitPolicy?: IncomingMessageCallback
```

```ts
    this.#commitPolicy = params.commitPolicy
```

- [ ] **Step 6: Apply the policy in `processMessage`**

Replace `processMessage` (lines 250-269) with a version that resolves the policy, passes it as `callback`, and throws on reject. Note `actionTaken` exists only on the `"newState"` result variant:

```ts
  async processMessage(
    message: Uint8Array | unknown,
    opts?: { commitPolicy?: IncomingMessageCallback },
  ): Promise<Uint8Array | null> {
    let decoded: unknown = message
    if (message instanceof Uint8Array) {
      const parsed = decode(mlsMessageDecoder, message)
      if (parsed == null) {
        throw new Error('processMessage: failed to decode MLSMessage')
      }
      decoded = parsed
    }
    const callback = opts?.commitPolicy ?? this.#commitPolicy
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: decoded as Parameters<typeof mlsProcessMessage>[0]['message'],
      ...(callback != null && { callback }),
    })
    // On reject, ts-mls returns the pre-commit state, so this re-assignment is a
    // no-op for the epoch (handle stays put).
    this.#state = result.newState
    if (result.kind === 'newState' && result.actionTaken === 'reject') {
      const proposals: Array<ProposalWithSender> = []
      throw new CommitRejectedError(proposals)
    }
    if (result.kind === 'applicationMessage') {
      return result.message
    }
    return null
  }
```

> Note on the rejected-proposal payload: ts-mls's `ProcessMessageResult` does
> not surface the rejected commit's proposals on the result object. To populate
> `CommitRejectedError.proposals`/`senderLeafIndex`, wrap the consumer's callback
> so it records the `{ proposals, senderLeafIndex }` it was given on the
> `"reject"` path, then read them after `mlsProcessMessage` returns. Implement
> this as a small local wrapper inside `processMessage`:
>
> ```ts
>     let rejected: { proposals: Array<ProposalWithSender>; senderLeafIndex?: number } | undefined
>     const wrapped: IncomingMessageCallback | undefined =
>       callback == null
>         ? undefined
>         : (incoming) => {
>             const action = callback(incoming)
>             if (action === 'reject' && incoming.kind === 'commit') {
>               rejected = {
>                 proposals: incoming.proposals,
>                 senderLeafIndex:
>                   incoming.senderLeafIndex == null ? undefined : Number(incoming.senderLeafIndex),
>               }
>             }
>             return action
>           }
> ```
>
> Pass `wrapped` as `callback`, and on the reject branch throw
> `new CommitRejectedError(rejected?.proposals ?? [], rejected?.senderLeafIndex)`.

- [ ] **Step 7: Apply the policy in `decrypt`**

Update `decrypt` (lines 218-239) to accept the same `opts` and resolve/forward the policy. `decrypt` only returns application messages, so a rejected handshake commit must surface as `CommitRejectedError` rather than the generic "Expected application message" error:

```ts
  async decrypt(
    message: Uint8Array | unknown,
    opts?: { commitPolicy?: IncomingMessageCallback },
  ): Promise<Uint8Array> {
    let decoded: unknown = message
    if (message instanceof Uint8Array) {
      const parsed = decode(mlsMessageDecoder, message)
      if (parsed == null) {
        throw new Error('decrypt: failed to decode MLSMessage')
      }
      decoded = parsed
    }
    const callback = opts?.commitPolicy ?? this.#commitPolicy
    const result = await mlsProcessMessage({
      context: this.#context,
      state: this.#state,
      message: decoded as Parameters<typeof mlsProcessMessage>[0]['message'],
      ...(callback != null && { callback }),
    })
    this.#state = result.newState
    if (result.kind === 'applicationMessage') {
      return result.message
    }
    if (result.kind === 'newState' && result.actionTaken === 'reject') {
      throw new CommitRejectedError([])
    }
    throw new Error('Expected application message but received handshake message')
  }
```

> Apply the same callback-wrapping from Step 6 here if you want `decrypt`'s
> `CommitRejectedError` to carry proposals; otherwise the empty-array form above
> is acceptable since `decrypt` is the application-message path.

- [ ] **Step 8: Thread `commitPolicy` through the three construction sites**

In `createGroup`'s `new GroupHandle({ ... })` (lines 318-325), add:

```ts
    commitPolicy: options?.commitPolicy,
```

In `restoreGroup`'s `new GroupHandle({ ... })` (lines 339-346), add:

```ts
    commitPolicy: params.options?.commitPolicy,
```

In `processWelcome`'s `new GroupHandle({ ... })` (lines 505-516), add:

```ts
    commitPolicy: options?.commitPolicy,
```

- [ ] **Step 9: Re-export from the package index**

In `packages/group/src/group.ts`'s already-exported surface, `CommitRejectedError` and the updated `GroupHandle` are exported from `./group.js` via `index.ts`. Add the missing names. In `packages/group/src/index.ts`, in the `from './group.js'` export block, add `CommitRejectedError` (alphabetical, near `commitInvite`). Then add a new export line for the ts-mls types:

```ts
export type { IncomingMessageCallback, ProposalWithSender } from 'ts-mls'
```

- [ ] **Step 10: Run the Gap 2 tests**

Run: `cd packages/group && pnpm exec vitest run test/groupcontext-extension.test.ts -t "Gap 2"`
Expected: PASS (all three Gap 2 tests).

- [ ] **Step 11: Run the full package test + typecheck**

Run: `cd packages/group && pnpm exec vitest run && pnpm run build:types`
Expected: PASS — no regression. In particular `group.test.ts` `processMessage`/`decrypt` call sites still compile (new param is optional).

- [ ] **Step 12: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add packages/group/src/types.ts packages/group/src/group.ts packages/group/src/index.ts packages/group/test/groupcontext-extension.test.ts
git commit -m "feat(group): commit policy hook with atomic reject

Thread a ts-mls IncomingMessageCallback through GroupHandle
processMessage/decrypt (per-handle default + per-call override).
Reject throws CommitRejectedError; handle stays at pre-commit epoch.
Enables GroupContext-extension immutability (Gap 2).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage:**
- Gap 1 `capabilities?: Capabilities` on `GroupOptions`, auto-derive at `createGroup`, explicit at `createKeyPackageBundle` → Task 1 Steps 3-4. ✓
- Gap 1 acceptance (invite/admit with matching capability; anchor readable post-Welcome; no-extension groups unaffected) → Task 1 Steps 1, 5. ✓
- Gap 2 raw `IncomingMessageCallback`, per-handle default + per-call override → Task 2 Steps 3, 5-8. ✓
- Gap 2 `CommitRejectedError` thrown on reject, handle stays pre-commit epoch (native) → Task 2 Steps 4, 6-7; asserted Step 1. ✓
- Gap 2 acceptance (reject anchor-mutating commit; normal commits unaffected; per-call override) → Task 2 Step 1 (three tests). ✓
- Re-export `IncomingMessageCallback` (+ `ProposalWithSender`, `CommitRejectedError`) → Task 2 Step 9. ✓
- Revocation reuse is "proven, not built" — no task, correct (out of scope). ✓
- Default behavior preserved (optional params, policy only when set) → Task 1 Step 1 second test, Task 2 Step 11. ✓

**Placeholder scan:** The two `> Note` blocks flag genuinely environment-dependent choices (exact `commitInvite` param key; whether to build the test commit inline via ts-mls vs. a helper) and give the concrete fallback in each case — not deferred work. No "TBD"/"add error handling" placeholders.

**Type consistency:** `IncomingMessageCallback`, `ProposalWithSender`, `Capabilities`, `GroupContextExtension` all from ts-mls; `CommitRejectedError(proposals, senderLeafIndex?)` constructor matches its throw sites; `commitPolicy` named identically across `GroupOptions`, `GroupHandleParams`, `processMessage`/`decrypt` opts, and the three construction sites. `defaultProposalTypes.group_context_extensions` matches ts-mls (`defaultProposalType.d.ts`).
