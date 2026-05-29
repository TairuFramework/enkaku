# Commit/Welcome Wire Encoding + Epoch Surface

**Status:** complete
**Date:** 2026-05-29
**Branch / PR:** `docs/commit-wire-encoding` / [#31](https://github.com/TairuFramework/enkaku/pull/31)
**Origin:** Downstream requirement from Kubun's MLS group-membership apply-time check (path A). Enkaku must emit wire-routable Commit/Welcome bytes so Kubun's hub relay (an untrusted Delivery Service) can fan them out to all members per RFC 9750 §6.1.

## Goal

Make `@enkaku/group` Commit and Welcome outputs **wire-ready** (`Uint8Array`) and **epoch-tagged** so consumers can route them through a Delivery Service to every group member. Previously `commitInvite`/`removeMember` returned ts-mls in-memory objects (`commitMessage: unknown`), unserializable without reaching past the public API.

## Key design decisions

- **Encode the already-framed ts-mls results directly — no manual framing.** `createCommit` returns `commit: MlsFramedMessage` and `welcome: MlsWelcomeMessage | undefined`, both already carrying version+wireformat. So `encode(mlsMessageEncoder, result.commit)` is a single call. This corrected the original spec §3.1, which wrongly prescribed building `MlsPublicMessage`/`MlsWelcome` framing and conflated this path with `joinGroupExternal` (which frames a *bare* `PublicMessage` from a different ts-mls call).
- **Commit framing stays `PrivateMessage` (the default).** Encrypted-to-current-epoch commits hide membership-change metadata (who is added/removed) from the untrusted relay. A clear `PublicMessage` commit would leak it. Confirmed correct against Kubun's hardened threat model; catch-up for behind-epoch peers is the hub's ordered replay, not clear handshakes.
- **`processWelcome` must decode framed Welcome bytes — corrected spec §4.** `mlsJoinGroup` takes the *inner* `Welcome` object, not bytes, with no internal decode. Since the Welcome output changed from inner-object to framed bytes, `processWelcome` gained a decode-at-entry step (validate `wireformat === mls_welcome`, extract `.welcome`). Landed in the same commit as the `commitInvite` producer change so no intermediate state broke existing tests.
- **Decode-at-entry is back-compatible.** `processMessage`/`decrypt`/`processWelcome` accept `Uint8Array | unknown`; bytes are decoded, pre-decoded objects pass straight through. Runtime back-compat for the type-breaking `unknown`→`Uint8Array` narrowing holds and is tested with real values (`encrypt`→`decrypt` object path; decoded-object `processMessage` in external rejoin).
- **`readMessageEpoch` returns the SENDING epoch, not the post-commit epoch — the consumer-facing off-by-one.** A Commit is framed at the sender's epoch *before* it advances the group (RFC 9420 `FramedContent.epoch`). So `readMessageEpoch(commitBytes)` = `result.epoch - 1n`, where `result.epoch == newGroup.epoch` is the *post*-commit epoch. The sending epoch is exactly what a receiver compares to its own `handle.epoch` for drop/process/buffer ordering — so `readMessageEpoch` is the correct primitive for the pre-check, and Kubun must order on it, **not** on `result.epoch` (which is sending+1). Documented in the JSDoc of both result types and the helper.
- **`readMessageEpoch` never throws.** It pre-filters bytes from an untrusted DS, so the ts-mls `decode` (which throws `CodecError` on >64M input) is wrapped; any unparseable input returns `undefined`.
- **Patch-level release for a type break (0.16.1).** `unknown`→`Uint8Array` is semver-major at the type level but runtime-narrower; no in-repo package consumes `@enkaku/group`, and the sole consumer (Kubun) updates in lockstep. Accepted as a patch by the user.

## What was built

`@enkaku/group` (0.16.0 → 0.16.1):

- `CommitInviteResult.commitMessage`/`welcomeMessage` → `Uint8Array`; `RemoveMemberResult.commitMessage` → `Uint8Array`; both gain `epoch: bigint` (== `newGroup.epoch`, post-commit).
- `GroupHandle.processMessage` and `decrypt` accept `Uint8Array | unknown` with decode-at-entry.
- `processWelcome` accepts framed Welcome bytes (decode + wireformat validation), back-compat with the inner object.
- New exported `readMessageEpoch(bytes): bigint | undefined` — advisory, pure cleartext-header decode covering private commits, public commits (`joinGroupExternal`), and application messages.
- Tests: bytes round-trip + epoch values for add/remove; receiver join+apply via bytes; stale-commit-bytes rejection; sending-epoch peek semantics (private + public-message branches); oversized/garbage input → `undefined`.

## Status

Complete and reviewed (spec + quality review per task, final whole-feature review, and a pre-merge review — all merge-ready). 97 tests pass, lint clean, types clean, build emits `readMessageEpoch`. Working tree clean on `docs/commit-wire-encoding`.

## Follow-on

- **Kubun (cross-repo):** after publish, bump `@enkaku/group` catalog (Kubun's `minimumReleaseAgeExclude: @enkaku/*` bypasses release-age delay), adapt `InvitePayload` (`packages/plugin-p2p/src/groups/invite-payload.ts`) welcome encode/decode + its `processWelcome` call site to the bytes contract, and wire path-A apply-time ordering on `readMessageEpoch(commitBytes)` vs `handle.epoch`.
- **Optional enkaku hardening (low priority, declined for this release):** `processMessage` could reject `mls_welcome`/`mls_group_info` wireformats early with a clear error instead of letting `mlsProcessMessage` surface an opaque one. Not a regression (pre-existing behavior); out of the minimal scope.
