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

4. **`processWelcome`** (`group.ts:403`, `:430-439`) — **corrects spec §4 "no change to processWelcome".** The welcome output now changes from the inner `Welcome` object (`result.welcome.welcome`) to framed `Uint8Array` bytes, but `mlsJoinGroup` requires `welcome: Welcome` (the inner object — ts-mls `clientState.d.ts:110`, no internal decode). So `processWelcome` MUST decode: `welcome: Uint8Array | unknown`; when `instanceof Uint8Array`, `decode(mlsMessageDecoder, welcome)`, assert `wireformat === mls_welcome`, pass `decoded.welcome` (inner) to `mlsJoinGroup`. Non-bytes inputs pass through. This decode must land in the same commit as item 1 — existing tests feed `welcomeMessage`→`processWelcome`, so flipping the producer without it breaks them.

5. **Version:** bump `packages/group/package.json` 0.16.0 → 0.16.1 (patch; type-level breaking change accepted as patch). No enkaku-side `pnpm-workspace.yaml` catalog entry exists for `@enkaku/group` and no internal package consumes it — nothing to bump here (spec §5's catalog step does not apply enkaku-side; the catalog bump is kubun-side per spec §8).

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

## Kubun-side review feedback (2026-05-29 — for enkaku review)

Reviewed against the kubun consumer's hardened threat model (untrusted blind-mailbox relay; durable + ordered + replay-on-reconnect hub). Three notes:

1. **PrivateMessage default is the right hardened choice — confirmed, please keep.** `result.commit` defaulting to `MlsPrivateMessage` (encrypted to the current epoch) is correct for kubun: the relay is untrusted, so a clear `PublicMessage` commit would leak membership-change metadata (who is added/removed) to it. Encrypted commits hide it. Kubun's earlier design draft (send handshakes in clear) was wrong on this; corrected kubun-side. **Do not switch commit framing to `PublicMessage`.** Catch-up for a behind-epoch peer is handled by the hub's ordered replay (drains missed commits in epoch order, each decryptable at the right epoch in sequence) — no need for clear handshakes. Residual: if the mailbox retention window expires before an offline peer reconnects, that peer falls back to external rejoin (kubun backlog `mls-external-join-stale-recovery`), not to a clear commit.

2. **Epoch must be readable for a pre-check without decrypting.** Kubun's receiver pre-checks the commit epoch against `handle.epoch` before processing (drop stale / buffer future). Two viable sources: (a) the MLS `PrivateMessage` cleartext header already carries `group_id` + `epoch` — if enkaku can expose a cheap "peek epoch from framed bytes" helper that would be ideal; (b) otherwise kubun carries the `epoch: bigint` (the new result field) in its own clear outer wire frame. (b) works with no further enkaku change, so this is a *nice-to-have* on the enkaku side, not a blocker. Flagging in case a peek helper is cheap to expose.

3. **Welcome-consumer coordination (kubun-side, FYI — confirms item 4 matters).** Flipping `CommitInviteResult.welcomeMessage` object→`Uint8Array` ripples into kubun's `InvitePayload` (`packages/plugin-p2p/src/groups/invite-payload.ts`), which carries the welcome out-of-band to the joiner, and into kubun's `processWelcome` call site. Item 4's `processWelcome` byte-decode covers the enkaku half; kubun adapts its invite encode/decode + call site in lockstep. No enkaku action needed beyond item 4 — recorded so the cross-repo change set is complete.

(Version: kubun is fine with `0.16.1` patch for now — ignore the earlier minor-bump suggestion.)
