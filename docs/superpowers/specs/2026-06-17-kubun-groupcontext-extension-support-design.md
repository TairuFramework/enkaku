# Custom GroupContext extension support for kubun — design

**Date:** 2026-06-17
**Package:** `@enkaku/group`
**Origin:** `docs/agents/plans/backlog/kubun-group-context-extension-immutability.md`
**Related (future, out of scope):** `docs/agents/plans/next/mls-capability-revocation.md`

## Summary

Kubun bakes a genesis anchor into the MLS `GroupContext`: a custom extension carrying
the creator's DID (the epoch-0 admin), used as the immutable root of an authenticated
admin chain. Two enkaku gaps block this:

- **Gap 1 (blocking):** leaf nodes cannot advertise custom extension capabilities, so
  any group created with a custom GroupContext extension is un-joinable — `commitInvite`
  throws `ValidationError: Added leaf node that doesn't support extension in GroupContext`.
- **Gap 2 (hardening):** no way for a consumer to reject a commit that mutates the
  GroupContext extension vector, so the immutability guarantee cannot be claimed.

Key finding from code investigation: **both gaps are pure plumbing of ts-mls primitives
enkaku already depends on but does not wire through.** No deep MLS work, no new packages.

- `generateKeyPackageWithKey` already accepts `capabilities?: Capabilities`
  (`ts-mls/dist/src/keyPackage.d.ts:46`); enkaku calls it bare at `createGroup`
  (`group.ts:292`) and `createKeyPackageBundle` (`group.ts:640`).
- `processMessage` already accepts `callback?: IncomingMessageCallback` returning
  `"accept" | "reject"` (`ts-mls/dist/src/processMessages.d.ts:51`). The callback
  receives `{ kind: "commit", senderLeafIndex, proposals: ProposalWithSender[] }`,
  and a contained `group_context_extensions` proposal exposes its proposed vector as
  `GroupContextExtension[]` directly (`proposal.d.ts:49`).
- **Atomicity is native:** on `reject`, ts-mls `processCommit` returns
  `newState: state` — the unchanged pre-commit state (`processMessages.js:159`).
  Enkaku's `this.#state = result.newState` re-assigns the same state, so the handle
  never advances past a refused commit. The backlog doc's hard constraint is met for free.

## Design principles

Follow enkaku's existing ts-mls boundary: **pass ts-mls data types raw, wrap only where
enkaku adds auth value.** `GroupContextExtension`, `ClientState`, `KeyPackage`,
`PrivateKeyPackage`, `CryptoProvider` are already public via `GroupOptions` /
`KeyPackageBundle` / `codec.ts`. `GroupHandle` and `MemberCredential` wrap behavior/auth,
not data. The hook therefore exposes the raw ts-mls `IncomingMessageCallback` rather than
a wrapper that would hide `senderLeafIndex` / proposal types that revocation and other
consumers may need.

## Component 1 — Leaf capabilities (Gap 1)

### API surface
`GroupOptions` (`types.ts`) gains:

```ts
/** Raw ts-mls leaf-node capabilities. Overrides auto-derivation at createGroup. */
capabilities?: Capabilities
```

(`Capabilities` imported as a type from `ts-mls`, consistent with the existing
`CryptoProvider` / `GroupContextExtension` imports in `types.ts`.)

### createGroup (`group.ts:292`)
Build leaf capabilities, pass to `generateKeyPackageWithKey`:

- If `options.capabilities` provided → use verbatim (consumer's responsibility).
- Else → `{ ...defaultCapabilities(), extensions: deriveExtensionTypes(options.extensions) }`.

`deriveExtensionTypes` collects the `extensionType` number of each entry in
`options.extensions` that is not already a default extension type, unions it with
`defaultCapabilities().extensions`, and dedupes. Every `GroupContextExtension` carries
`extensionType: number` (`extension.d.ts:8-12`), so derivation is mechanical. Auto-derive
guarantees the RFC 9420 requirement that a leaf advertise every GroupContext extension —
zero-config, cannot desync from `options.extensions`.

### createKeyPackageBundle (`group.ts:640`)
Pass `options?.capabilities ?? defaultCapabilities()` to `generateKeyPackageWithKey`. The
invitee has no group extensions to derive from (it generates a KeyPackage before knowing
the group), so capabilities are explicit. Kubun passes
`{ ...defaultCapabilities(), extensions: [ANCHOR_EXTENSION_TYPE] }`.

### Data flow
creator leaf advertises anchor type → `commitInvite` validates the invitee leaf against
GroupContext extensions → passes because the invitee KeyPackage advertised the type →
Welcome carries the anchor (covered by GroupInfo signature + confirmation tag) → joiner
reads the anchor after `processWelcome`.

### Acceptance criteria
- A group created with a custom GroupContext extension invites and admits a member whose
  KeyPackage was generated with the matching capability, with no `validateProposals` error.
- The custom extension value is readable by creator and every joiner after `processWelcome`.
- Groups created without custom extensions are unaffected — default capabilities unchanged.

## Component 2 — Commit policy hook (Gap 2)

### API surface
- `GroupHandle` stores `#commitPolicy?: IncomingMessageCallback`, seeded via
  `GroupHandleParams` so `createGroup` / `restoreGroup` / `processWelcome` can set it
  (a group-level property — anchor immutability is a property of the group).
- `processMessage(message, opts?)` and `decrypt(message, opts?)` accept
  `opts?: { commitPolicy?: IncomingMessageCallback }` for per-call override.
- `IncomingMessageCallback` re-exported from the package index (raw ts-mls type).
- `CommitRejectedError extends Error`, exported from index. Fields:
  `proposals: ProposalWithSender[]`, `senderLeafIndex?: number`.

### processMessage behavior (`group.ts:250`)
1. Resolve policy: `opts?.commitPolicy ?? this.#commitPolicy` (per-call override beats
   per-handle default). If none, behavior is identical to today.
2. Pass the resolved policy as `callback` to `mlsProcessMessage`.
3. `this.#state = result.newState` (unchanged line — already correct: on reject this is
   the pre-commit state).
4. If `result.actionTaken === 'reject'` → throw `CommitRejectedError` carrying
   `result`'s proposal info. Handle stays at pre-commit epoch.
5. Otherwise return as today (`applicationMessage` → bytes, else `null`).

`decrypt` (`group.ts:218`) receives the same policy-resolution + reject-throw treatment
for consistency.

### Consumer usage (kubun anchor policy — illustrative, lives in kubun)
A `commitPolicy` callback that inspects `proposals` for a proposal with
`proposalType === defaultProposalTypes.groupContextExtensions` whose `extensions` vector
touches the anchor extension type, and returns `'reject'`; all other commits
(`add` / `remove` / `update`) return `'accept'`.

### Atomicity
Native — ts-mls returns `newState: state` on reject (`processMessages.js:159`). No epoch
advance, no persistence rollback needed for the in-memory handle. (Persisting the rejected
state to durable storage is kubun-side commit-atomicity work, out of scope here.)

### Acceptance criteria
- A received commit carrying a `group_context_extensions` proposal that touches the anchor
  extension is rejected by the consumer's policy before the effective state advances; the
  handle remains at its pre-commit epoch and `processMessage` throws `CommitRejectedError`.
- A normal commit (Add, Remove, Update) is unaffected and applies as today.
- A per-call `commitPolicy` overrides the per-handle default.

## Revocation reuse (proven, not built)

`docs/agents/plans/next/mls-capability-revocation.md` option 2/3 (GroupContext banlist) is
built from exactly these two primitives:

- a `bannedDIDs` GroupContext extension + matching leaf capability — Component 1;
- a member-side `commitPolicy` rejecting commits that add a banned DID — Component 2 (its
  line 26 "validator that runs before `mlsProcessMessage` and rejects before state
  advances" is this hook).

The hook contract is therefore designed to satisfy both consumers with no later redesign.
The revocation feature itself (token distribution, per-epoch vs permanent, re-admit) stays
its own future spec.

## Error handling

- `CommitRejectedError` is thrown only on a policy reject; the handle is untouched.
- Capability mismatch at invite continues to surface ts-mls `ValidationError` as today —
  now avoidable by setting leaf capabilities via Component 1.

## Testing

Gap 1:
- create group with a custom GroupContext extension → `createKeyPackageBundle` with the
  matching `capabilities` → invite + commit → admit; assert no `validateProposals` error
  and both creator and joiner read the anchor after Welcome.
- regression: group created without custom extensions still invites/admits with unchanged
  default capabilities.

Gap 2:
- received `group_context_extensions` commit touching the anchor → policy returns
  `'reject'` → `processMessage` throws `CommitRejectedError`; assert handle epoch unchanged.
- normal Add/Remove/Update commit applies unchanged with a reject-on-anchor policy in place.
- per-call `commitPolicy` overrides the per-handle default.

## Out of scope

- The full revocation mechanism (distribution channel, permanence model, re-admission).
- Kubun-side policy logic and durable commit-atomicity persistence beyond the in-memory
  handle guarantee.
- Any change to groups that use no custom extensions / no commit policy — default behavior
  is byte-for-byte preserved.
