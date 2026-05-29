# Commit/Welcome wire encoding + epoch surface

**Spec:** `docs/superpowers/specs/2026-05-29-commit-wire-encoding-design.md`
**Consumer:** Kubun — MLS group-membership apply-time check (path A).
**Target:** `@enkaku/group@0.17.0`.

## Why

RFC 9750 §6.1 requires that all current members of an MLS group receive the Commit for any add/remove. Consumers (kubun) cannot route Commits today because `commitInvite` and `removeMember` return ts-mls in-memory objects (`commitMessage: unknown`), not wire-ready bytes. The encoder already exists (`encode(mlsMessageEncoder, framedCommit)` at `packages/group/src/group.ts:629` inside `joinGroupExternal`) but is never applied to the membership-mutation outputs.

## Scope

1. `CommitInviteResult.commitMessage`, `CommitInviteResult.welcomeMessage`, `RemoveMemberResult.commitMessage` → `Uint8Array` (was `unknown`).
2. Add `epoch: bigint` to both result types (`== newGroup.epoch`).
3. `GroupHandle.processMessage` and `GroupHandle.decrypt` accept `Uint8Array | unknown` — auto-`decode` bytes path at entry.
4. Tests in `packages/group/test/group.test.ts`: bytes round-trip via `processMessage`, epoch field matches.
5. Bump `@enkaku/group` to `0.17.0`.

## Out of scope

Standalone proposals, self-remove primitive, DS adapter — all stay consumer-side.

## Coordination

Kubun catalog already has `minimumReleaseAgeExclude: @enkaku/*`; bump lands without release-age delay. After publish, kubun updates `pnpm-workspace.yaml` and wires `packages/plugin-p2p/src/groups/manager.ts` to consume the new bytes contract.
