# `@enkaku/group` — `inspectGroupInfo` helper

**Status:** complete
**Date:** 2026-06-03
**Package:** `@enkaku/group` (released `0.16.2`)
**Origin:** Follow-on to `2026-04-20-mls-external-rejoin.complete.md`. Requested by kubun MLS stale-device recovery (scope A).

## Goal

Give a stale device a non-destructive way to confirm its external-resync Commit was canonically accepted, without performing another join or mutating MLS state.

## What was built

- `inspectGroupInfo(groupInfoBytes: Uint8Array): InspectGroupInfoResult` — decodes a framed MLSMessage(GroupInfo), guards on decode-null + wireformat (mirroring `joinGroupExternal`), returns `{ epoch: bigint; treeHash: Uint8Array }` read straight off `groupContext`. Throws on malformed/wrong input (contrast with the total, never-throwing `readMessageEpoch`). No signature verification (structural read of already-trusted bytes).
- `GroupHandle.treeHash` getter — parity with the existing `epoch` getter, so the consumer compares against its own post-commit state without reaching into `.state`.
- Exported both from `index.ts`; version bump `0.16.1 → 0.16.2`.
- Tests: round-trip epoch+treeHash match; epoch+treeHash both change on member add; malformed bytes throw; wrong wireformat (a real public message from `joinGroupExternal`) throws.

## Key design decision: treeHash, not member roster

The original design returned a **member roster** decoded from the GroupInfo's embedded ratchet tree via ts-mls `ratchetTreeFromExtension`. During implementation this proved infeasible: `ratchetTreeFromExtension` and the underlying `ratchetTreeDecoder` are **not** in ts-mls's public API (the `2.0.0-rc.13` package `exports` map exposes only `.`, the index re-exports neither, and deep imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`). No published ts-mls version exposes them.

Pivoted to **treeHash-based confirmation**, using only fields already public on the decoded `GroupContext` (`epoch`, `treeHash`). The confirmation check becomes:

```
fresh.epoch === myPostCommit.epoch && bytesEqual(fresh.treeHash, myPostCommit.treeHash)
```

`treeHash` is a collision-resistant hash over the entire ratchet tree (RFC 9420 §8.4). Equal `(epoch, treeHash)` ⟺ identical canonical group state — a **stronger** confirmation than "my leaf is present": it verifies the rejoiner's exact post-commit state is the one the group converged on, not merely that some commit re-added its leaf. Bonus: cheaper (no tree walk) and uses only the public API.

## Verification

- `pnpm --filter @enkaku/group run test`: 101/101 pass, types clean.
- Lint clean (`rtk proxy pnpm run lint`).
- Build: all 39 packages build.

## Follow-on work

- **kubun (consumer, separate repo):** the stale-recovery spec's Phase 3.5 confirmation step must change from "own leaf present at epoch ≥ expected" to the `(epoch, treeHash)` equality check above. kubun supplies its own `bytesEqual` (treeHash is non-secret; plain compare is fine).
- **Member roster (deferred):** if a roster read is ever needed, the path is upstreaming `ratchetTreeFromExtension` to ts-mls's public exports, then re-exposing it here. Not currently required — treeHash confirmation covers the recovery use case.
