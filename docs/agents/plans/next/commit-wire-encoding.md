# Commit/Welcome wire encoding + epoch surface

**Spec:** `docs/superpowers/specs/2026-05-29-commit-wire-encoding-design.md`
**Consumer:** Kubun — MLS group-membership apply-time check (path A).
**Target:** `@enkaku/group@0.16.1`.

## Why

RFC 9750 §6.1 requires every current member of an MLS group to receive the Commit for any add/remove. Consumers (kubun) cannot route Commits today because `commitInvite` and `removeMember` return ts-mls in-memory objects (`commitMessage: unknown`), not wire-ready bytes. The encoder already exists in the package (`encode(mlsMessageEncoder, …)`, used by `joinGroupExternal` at `packages/group/src/group.ts:629`) but is never applied to the membership-mutation outputs.

## Key correction vs spec §3.1

`createCommit` (ts-mls) already returns **framed** results — no manual `MlsPublicMessage`/`MlsWelcome` construction needed:

- `result.commit: MlsFramedMessage` (= `MlsPrivateMessage`, carries version+wireformat)
- `result.welcome: MlsWelcomeMessage | undefined` (already framed)

So encoding is a direct `encode(mlsMessageEncoder, result.commit)`. The spec's "appropriate framing" step and its claim that `joinGroupExternal` wraps the *same* `createCommit` output are inaccurate: `joinGroupExternal` frames a **bare** `PublicMessage` from `mlsJoinGroupExternal` (a different call). This plan supersedes spec §3.1's framing instruction.

`result.commit` defaults to `MlsPrivateMessage` (neither `commitInvite` nor `removeMember` sets `wireAsPublicMessage`) — encrypted to the current epoch, which is correct for broadcast to existing members.

## Scope

1. **`CommitInviteResult`** (`group.ts:353-357`):
   - `commitMessage: unknown` → `Uint8Array` = `encode(mlsMessageEncoder, result.commit)`
   - `welcomeMessage: unknown` → `Uint8Array`. ts-mls types welcome as optional; an add always yields a welcome, so guard:
     ```ts
     if (result.welcome == null) {
       throw new Error('commitInvite: expected a Welcome message for the add proposal')
     }
     ```
     then `welcomeMessage: encode(mlsMessageEncoder, result.welcome)`.
   - add `epoch: bigint` = `newGroup.epoch`.

2. **`RemoveMemberResult`** (`group.ts:465-468`):
   - `commitMessage: unknown` → `Uint8Array` = `encode(mlsMessageEncoder, result.commit)`
   - add `epoch: bigint` = `newGroup.epoch`.

3. **`GroupHandle.processMessage`** (`group.ts:225`) and **`GroupHandle.decrypt`** (`group.ts:207`): accept `Uint8Array | unknown`; at entry, `decode(mlsMessageDecoder, message)` when `message instanceof Uint8Array`, else pass through (back-compat for existing object callers). Delegate to `mlsProcessMessage` as today.

4. **Version:** bump `packages/group/package.json` 0.16.0 → 0.16.1 (patch; type-level breaking change accepted as patch). No enkaku-side `pnpm-workspace.yaml` catalog entry exists for `@enkaku/group` and no internal package consumes it — nothing to bump here (spec §5's catalog step does not apply enkaku-side; the catalog bump is kubun-side per spec §8).

## Tests (`packages/group/test/group.test.ts`)

Add `decode`, `mlsMessageDecoder` to the ts-mls import.

- `commitInvite` → `commitMessage` and `welcomeMessage` are `Uint8Array`; each `decode(mlsMessageDecoder, …)` yields a non-null MLSMessage with the expected wireformat (`mls_private_message` for commit, `mls_welcome` for welcome); `result.epoch === result.newGroup.epoch`.
- `removeMember` → `commitMessage` is `Uint8Array`; decodes; `result.epoch === result.newGroup.epoch`.
- Receiver `processMessage(commitBytes)` (bytes form) advances epoch identically to the prior object form — assert receiver epoch matches sender `newGroup.epoch` after processing.
- Stale-bytes rejection: a receiver already past the commit's epoch throws on `processMessage(staleCommitBytes)` (parity with `external-rejoin.test.ts:95-96`, bytes form).

## Out of scope

Standalone proposals, self-remove primitive, DS adapter — all stay consumer-side.

## Coordination

Kubun catalog already has `minimumReleaseAgeExclude: @enkaku/*`; bump lands without release-age delay. After publish, kubun updates its `pnpm-workspace.yaml` `@enkaku/group` catalog entry and wires `packages/plugin-p2p/src/groups/manager.ts` to the new bytes contract.
