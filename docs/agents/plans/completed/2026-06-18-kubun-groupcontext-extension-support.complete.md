# Custom GroupContext extension support for kubun — completed

**Date:** 2026-06-18
**Status:** complete
**Package:** `@enkaku/group`
**Origin:** consumer request `kubun-group-context-extension-immutability` (both enkaku-side
gaps now satisfied; the request file is removed)

## Goal

Let `@enkaku/group` consumers (kubun) create joinable MLS groups that carry a custom
GroupContext extension (kubun's genesis anchor — the epoch-0 admin DID, root of an
authenticated admin chain) and reject commits that mutate it.

## Key design decisions (preserved from spec)

- **Both gaps were pure plumbing of ts-mls primitives enkaku already depends on** — no
  deep MLS work, no new packages.
- **Pass ts-mls data types raw, wrap only where enkaku adds auth value.** The commit hook
  exposes the raw ts-mls `IncomingMessageCallback` rather than a wrapper, so
  `senderLeafIndex` / proposal types stay visible to future consumers (e.g. capability
  revocation via a GroupContext banlist, which reuses exactly these two primitives).
- **Commit-reject atomicity is native:** ts-mls `processCommit` returns the unchanged
  pre-commit state on reject, so `this.#state = result.newState` never advances the handle
  past a refused commit — the immutability hard-constraint is met for free.
- **Auto-derive leaf capabilities at `createGroup`** from `options.extensions` so the leaf
  advertisement (required by RFC 9420 for every non-default GroupContext extension) cannot
  desync from the group's extensions; explicit `options.capabilities` overrides verbatim.

## What was built

- **Gap 1 — leaf capabilities.** `GroupOptions.capabilities?: Capabilities`. `createGroup`
  auto-derives leaf capabilities from its extensions (`buildCreatorCapabilities`);
  `createKeyPackageBundle` takes explicit capabilities (`?? defaultCapabilities()`). Fixes
  the previously un-joinable anchored group (`commitInvite` no longer throws "Added leaf
  node that doesn't support extension in GroupContext").
- **Gap 2 — commit policy hook.** `GroupOptions.commitPolicy?: IncomingMessageCallback`
  seeds a per-handle default; `GroupHandle.processMessage`/`decrypt` accept a per-call
  `{ commitPolicy }` override (per-call beats per-handle). A reject throws
  `CommitRejectedError` (carrying `proposals` + `senderLeafIndex`); the handle stays at its
  pre-commit epoch. Re-exports: `CommitRejectedError`, `IncomingMessageCallback`,
  `ProposalWithSender`.

## Deviations from plan (all validated by code review)

- `commitInvite` is positional `(group, keyPackage)`, not an object param; the ts-mls
  proposal field is `groupContextExtensions`, not `group_context_extensions`; the plan's
  Gap-2 test flow was MLS-incorrect (a freshly-welcomed joiner cannot re-process the
  add-commit that added him) and was rewritten to a correct flow (creator captures
  `newGroup`, builds the mutating commit inline via ts-mls `createCommit`, adds a third
  member for the "normal add unaffected" case).
- **Extended beyond spec:** the commit policy is also carried onto handles derived via
  `commitInvite` / `removeMember` (new `GroupHandle.commitPolicy` getter) and
  `joinGroupExternal`, so an admin's continuing handle keeps enforcing immutability after
  it commits. The spec seeded only `createGroup`/`restoreGroup`/`processWelcome`, which
  left a real enforcement gap on the committer's own handle (code review issue #1).

## Status

Complete. 111 tests pass in `packages/group` (incl. `test/groupcontext-extension.test.ts`),
typecheck and lint clean. Code-reviewed (verdict: merge with fixes — all Important/Minor
issues addressed). Commits: `fcf1341`, `a5b05ff`, `4c2894b`, `358cfef` on `feat/mls-extension`.

## Follow-on work

- Kubun-side (separate repo, not enkaku backlog): anchor `commitPolicy` logic, durable
  commit-atomicity persistence beyond the in-memory handle guarantee.
- Out of scope / future: MLS capability revocation (GroupContext banlist) reuses these two
  primitives — `docs/agents/plans/backlog/mls-permission-enforcement.md` and the revocation
  spec.
