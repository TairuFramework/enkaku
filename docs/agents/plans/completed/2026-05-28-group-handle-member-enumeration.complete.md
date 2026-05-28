# GroupHandle Member Enumeration

**Status:** complete
**Date:** 2026-05-28
**Branch / PR:** `docs/group-handle-member-enumeration` / [#30](https://github.com/TairuFramework/enkaku/pull/30)
**Origin:** Downstream requirement from Kubun's MLS group-membership apply-time write check (`feat/mls-membership-check`).

## Goal

Give consumers a way to learn, on the receive side, which member DIDs an incoming MLS commit removed. ts-mls `processMessage()` surfaces no membership diff, so the robust primitive is to enumerate members before and after applying the commit and diff the two sets. `GroupHandle` previously exposed only `findMemberLeafIndex` (forward DID→leaf lookup) — no inverse and no "list all members" accessor.

## Key design decisions

- **Pre/post enumeration is the primitive, not commit introspection.** A consumer calls `listMembers()` before and after `processMessage(commit)` and diffs the sets. Parsing proposal lists out of a commit is fragile and ts-mls does not surface them, so that path was deliberately avoided. `processMessage`'s signature/return type is unchanged.
- **Field named `id`, not `did`.** Matches `MLSCredentialIdentity.id`, `parsed.id`, and the `findMemberLeafIndex(id)` parameter. The package uses `id` for identity *values*; `DID` appears only in type names.
- **Single source of truth via a private generator.** The leaf-walk, credential parse, `i/2` leaf-index convention, and skip-on-parse-failure tolerance live once in `#iterateMembers()`. Both `findMemberLeafIndex` (early-returns on first match) and `listMembers()` (collects all) consume it — chosen over an eager collector to preserve `findMemberLeafIndex`'s early-return.
- **Parse tolerance preserved.** A leaf whose credential identity fails to parse is skipped, not thrown, so one malformed leaf cannot break enumeration.
- **`listMembers()` reads current `#state`.** Reflects state after it is advanced (`processMessage` advances and returns `null` for handshakes; `decrypt` advances then throws) — either works for the pre/post diff.
- **Capability revocation kept out of scope.** `mls-capability-revocation.md` is backlog with an open design space (3 candidate designs, unresolved questions); it is write-path enforcement, not read-only enumeration. `listMembers()` is a primitive that revocation can build on later, but they are not coupled.

## What was built

`@enkaku/group`:

- `GroupMember` type (`{ leafIndex: number; id: string }`) in `credential.ts`, exported from the package index.
- Private generator `GroupHandle.#iterateMembers()` factored out of `findMemberLeafIndex`; `findMemberLeafIndex` refactored to consume it (behavior unchanged).
- Public `GroupHandle.listMembers(): Array<GroupMember>` returning members in ascending leaf-index order.
- Tests: multi-member enumeration; add/remove reflected after `processMessage` on a real receiver; unparseable-leaf skipped without throwing.

## Status

Complete and reviewed (spec + quality review per task, final whole-feature review merge-ready). 93 tests pass, lint clean, build emits `GroupMember`. PR #30 open against `main`.

## Follow-on

- Once merged + published, Kubun's Phase 2 (`mls-membership-apply-check`, Q2.3/Q2.4) bumps `@enkaku/group` and consumes `listMembers()`.
- `mls-capability-revocation.md` (remains in `next/`) is a downstream consumer: its member-side enforcement hook in `processMessage` can enumerate the ratchet tree via the same walk to validate adds against a banlist.
