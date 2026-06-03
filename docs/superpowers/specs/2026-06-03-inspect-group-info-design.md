# `@enkaku/group` — `inspectGroupInfo` helper — Design

**Date:** 2026-06-03
**Package:** `@enkaku/group`
**Priority:** next (blocks kubun MLS stale-device recovery, scope A)
**Origin:** Follow-on to `2026-04-20-mls-external-rejoin.complete.md`. Requested by kubun spec `docs/superpowers/specs/2026-06-03-mls-external-join-stale-recovery-design.md` (plan Phase 3.5). Supersedes `docs/agents/plans/next/group-inspect-group-info.md`.

> **Revision (2026-06-03, during implementation):** the original design returned a member roster decoded from the GroupInfo's embedded ratchet tree via ts-mls `ratchetTreeFromExtension`. That function — and the underlying `ratchetTreeDecoder` — are **not** part of ts-mls's public API (the package `exports` map exposes only `.`, and the index re-exports neither; deep imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`). So a member roster cannot be produced from a GroupInfo through the public API at the pinned `ts-mls@2.0.0-rc.13`. The design pivots to **treeHash-based confirmation**, which uses only fields already public on the decoded `GroupContext` (`epoch`, `treeHash`).

## Problem

A device recovering from MLS epoch staleness rejoins via `joinGroupExternal({ resync: true })`, broadcasts its resync Commit, then must **confirm** the Commit was canonically accepted before persisting its new MLS state. If another Commit won the epoch race, the group sits at the same numeric epoch via a different Commit and the rejoiner's state diverged → it must retry.

`@enkaku/group` today exposes no way to read a `GroupInfo`'s epoch or tree state without performing a full join. `exportGroupInfo` produces the bytes; `joinGroupExternal` decodes them internally (`group.ts:688`) but exposes nothing. `mlsMessageDecoder` is not re-exported. So the consumer cannot inspect a GroupInfo non-destructively.

## Confirmation primitive: treeHash + epoch

Every MLS `GroupContext` carries a `treeHash: Uint8Array` — a collision-resistant hash over the entire ratchet tree (RFC 9420 §8.4). Two group states share the same `(epoch, treeHash)` **iff they are the same canonical group state** — same membership, same tree. This is a strictly stronger confirmation than "my leaf is present": it confirms the rejoiner's exact post-commit state is the one the group converged on, not merely that some commit re-added the rejoiner's leaf.

The rejoiner already holds its own post-commit state after `joinGroupExternal` returns (`group.state.groupContext.{epoch,treeHash}`). Confirmation = fetch a fresh `GroupInfo` from a current member, `inspectGroupInfo` it, and check:

```
fresh.epoch === myPostCommit.epoch && bytesEqual(fresh.treeHash, myPostCommit.treeHash)
```

Equal → the rejoiner's Commit won; persist. Not equal → another Commit won the race; retry.

## Goal

Add a non-destructive structural reader to `packages/group/src/group.ts`, exported from `index.ts`, that returns a GroupInfo's `epoch` and `treeHash` without joining and without mutating state. Add a `treeHash` getter to `GroupHandle` (parity with the existing `epoch` getter) so the consumer compares against its own state without reaching into `.state.groupContext`.

## Non-goals

- **No member roster.** Decoding the embedded ratchet tree into leaves needs a non-public ts-mls decoder (see Revision note). If a roster is needed later, the path is upstreaming `ratchetTreeFromExtension` to ts-mls's public exports — out of scope here.
- **No signature verification.** Structural read of an already-trusted GroupInfo (caller obtained it over the group's authorized channel). JSDoc states it does not validate the GroupInfo signature.
- **No capability-layer revocation.** Separate problem (`next/mls-capability-revocation.md`), out of scope.

## API

```ts
export type InspectGroupInfoResult = {
  /** The GroupInfo's epoch, read from its groupContext. */
  epoch: bigint
  /** The GroupInfo's ratchet-tree hash, read from its groupContext. Compare
   *  for equality against a known post-commit state's treeHash to confirm
   *  canonical convergence. */
  treeHash: Uint8Array
}

export function inspectGroupInfo(groupInfoBytes: Uint8Array): InspectGroupInfoResult
```

## Design

### Inspector

```ts
export function inspectGroupInfo(groupInfoBytes: Uint8Array): InspectGroupInfoResult {
  const message = decode(mlsMessageDecoder, groupInfoBytes)
  if (message == null) {
    throw new Error('Invalid groupInfo: failed to decode MLSMessage')
  }
  if (message.wireformat !== wireformats.mls_group_info) {
    throw new Error(
      `Invalid groupInfo: expected wireformat mls_group_info, got ${String(message.wireformat)}`,
    )
  }
  const { groupContext } = message.groupInfo
  return { epoch: groupContext.epoch, treeHash: groupContext.treeHash }
}
```

- Decode + wireformat guards mirror `joinGroupExternal` (`group.ts:688–696`) verbatim — the only two failure modes for a structural read of trusted bytes.
- `epoch` and `treeHash` both come straight off `message.groupInfo.groupContext`; no extension decode, no ratchet tree.
- Unlike `readMessageEpoch` (a total, never-throwing pre-filter over untrusted DS bytes), `inspectGroupInfo` **throws** on malformed input — the caller holds a GroupInfo it already trusts, so malformed bytes are a programming error, not expected traffic.

### `GroupHandle.treeHash` getter

Mirror the existing `epoch` getter (`group.ts:120–122`):

```ts
get treeHash(): Uint8Array {
  return this.#state.groupContext.treeHash
}
```

### Imports / exports

- `group.ts`: no new ts-mls imports — `decode`, `mlsMessageDecoder`, `wireformats` are already imported.
- `index.ts`: add `inspectGroupInfo` and `type InspectGroupInfoResult` to the existing `./group.js` export block.

## Testing

New file `packages/group/test/inspect-group-info.test.ts` (alongside `external-rejoin.test.ts`):

- **Round-trip (happy path):** build a real group, `exportGroupInfo`, `inspectGroupInfo`. Assert `epoch` equals the source handle's `epoch` and `treeHash` deep-equals the handle's `treeHash` getter.
- **Convergence semantics:** advance the group one epoch (add a member), re-export, re-inspect; assert the new `epoch`/`treeHash` differ from the pre-advance snapshot (treeHash changes when the tree changes).
- **Malformed bytes throw:** random/garbage `Uint8Array` → throws.
- **Wrong wireformat throws:** feed a non-GroupInfo framed MLS message (the public-message `commitMessage` returned by `joinGroupExternal`) → throws the wireformat error.

## Release

- Version-bump `@enkaku/group` `0.16.1` → `0.16.2`.
- Build (`pnpm run build`).
- Respect the repo's `minimumReleaseAge` verify gate on the bump commit.

## Notes for kubun consumer

- Confirmation is `fresh.epoch === expected && bytesEqual(fresh.treeHash, rejoinedGroup.treeHash)`. kubun supplies its own constant-time-agnostic `bytesEqual` (treeHash is not secret; a plain length+byte compare is fine).
- The kubun stale-recovery spec's Phase 3.5 confirmation step must be updated from "own leaf present at epoch ≥ expected" to the treeHash+epoch equality check above. This is a consumer-side spec change tracked in that repo.
