# `@enkaku/group` — `inspectGroupInfo` helper — Design

**Date:** 2026-06-03
**Package:** `@enkaku/group`
**Priority:** next (blocks kubun MLS stale-device recovery, scope A)
**Origin:** Follow-on to `2026-04-20-mls-external-rejoin.complete.md`. Requested by kubun spec `docs/superpowers/specs/2026-06-03-mls-external-join-stale-recovery-design.md` (plan Phase 3.5). Supersedes `docs/agents/plans/next/group-inspect-group-info.md`.

## Problem

A device recovering from MLS epoch staleness rejoins via `joinGroupExternal({ resync: true })`, broadcasts its resync Commit, then must **confirm** the Commit was canonically accepted before persisting its new MLS state. Confirmation = re-fetch a fresh `GroupInfo` from a current member and check **"my leaf is present at epoch ≥ my expected post-commit epoch."** If another Commit won the epoch race, the group sits at the same numeric epoch via a different Commit and the rejoiner's leaf is absent → it must retry.

`@enkaku/group` today exposes no way to read a `GroupInfo`'s epoch or member leaves without performing a full join. `exportGroupInfo` produces the bytes; `joinGroupExternal` decodes them internally (`group.ts:688`) but exposes nothing. `mlsMessageDecoder` is not re-exported. So the consumer cannot inspect a GroupInfo non-destructively.

## Goal

Add a non-destructive structural inspector to `packages/group/src/group.ts`, exported from `index.ts`, that returns a GroupInfo's epoch and full member roster (leafIndex + id) without joining and without mutating state.

## Non-goals

- **No signature verification.** This is a structural read of an already-trusted GroupInfo (caller obtained it over the group's authorized channel). JSDoc states it does not validate the GroupInfo signature.
- **No capability-layer revocation.** A removed-but-credential-retaining device can still be inspected as present if it managed to rejoin; that is the separate revocation problem (`next/mls-capability-revocation.md`), out of scope here.

## API

```ts
export type InspectGroupInfoResult = {
  epoch: bigint
  members: Array<GroupMember>
}

export function inspectGroupInfo(groupInfoBytes: Uint8Array): InspectGroupInfoResult
```

`members` reuses the existing exported `GroupMember` type (`credential.ts:31`, fields `{ leafIndex: number; id: string }`) — identical shape to `listMembers()`, so kubun compares the inspector's roster against `findMemberLeafIndex`/`listMembers` directly.

## Design

### Shared leaf-walk helper

Extract the leaf-walk currently inside `GroupHandle.#iterateMembers` (`group.ts:154–171`) to a module-level generator. Single source of truth for both the handle method and the inspector.

```ts
function* iterateLeaves(tree: RatchetTree): Generator<GroupMember> {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node != null && node.nodeType === nodeTypes.leaf) {
      const credential = node.leaf.credential
      if ('identity' in credential) {
        let parsed: ReturnType<typeof parseMLSCredentialIdentity>
        try {
          parsed = parseMLSCredentialIdentity(credential.identity)
        } catch {
          continue
        }
        yield { leafIndex: i / 2, id: parsed.id }
      }
    }
  }
}
```

`#iterateMembers` becomes:

```ts
*#iterateMembers(): Generator<GroupMember> {
  yield* iterateLeaves(this.#state.ratchetTree)
}
```

Behaviour is byte-for-byte identical: same `leafIndex = i / 2` convention, same parse-failure skip tolerance. The existing `listMembers`/`findMemberLeafIndex` tests are the regression guard for this refactor.

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
  const tree = ratchetTreeFromExtension(message.groupInfo)
  if (tree == null) {
    throw new Error('Invalid groupInfo: missing ratchet tree extension')
  }
  return {
    epoch: message.groupInfo.groupContext.epoch,
    members: [...iterateLeaves(tree)],
  }
}
```

- Decode + wireformat guards mirror `joinGroupExternal` (`group.ts:688–696`) verbatim.
- `ratchetTreeFromExtension(message.groupInfo)` (ts-mls) extracts the embedded ratchet tree. A GroupInfo from `exportGroupInfo` always embeds it (`ratchetTreeExtension: true`); a missing tree throws.
- `epoch` from `message.groupInfo.groupContext.epoch`.
- Unlike `readMessageEpoch` (a total, never-throwing pre-filter over untrusted DS bytes), `inspectGroupInfo` **throws** on malformed input — the caller holds a GroupInfo it already trusts, so malformed bytes are a programming error, not expected traffic.

### Imports / exports

- `group.ts` ts-mls import: add `ratchetTreeFromExtension` and `type RatchetTree`.
- `index.ts`: add `inspectGroupInfo` and `type InspectGroupInfoResult` to the existing `./group.js` export block.

## Testing

New file `packages/group/test/inspect-group-info.test.ts` (alongside `external-rejoin.test.ts`):

- **Round-trip (happy path):** build a real multi-member group, `exportGroupInfo`, `inspectGroupInfo`. Assert `epoch` equals the source handle's epoch and `members` deep-equals `handle.listMembers()` (full set, leafIndex + id).
- **Malformed bytes throw:** random/garbage `Uint8Array` → throws.
- **Wrong wireformat throws:** feed a non-GroupInfo framed MLS message (e.g. a public/private message) → throws the wireformat error.
- **Missing ratchet-tree extension throws:** construct/strip a GroupInfo without the extension → throws the missing-tree error.

## Release

- Version-bump `@enkaku/group` `0.16.1` → `0.16.2`.
- Build (`pnpm run build`).
- Respect the repo's `minimumReleaseAge` verify gate on the bump commit.

## Notes for kubun consumer

- Consumer-side check is "own leaf present at epoch ≥ expected"; returning the full member list (not a boolean) keeps the helper general and lets kubun log roster state on confirm.
- `leafIndex` convention matches `listMembers` (`i / 2`) so kubun compares against `findMemberLeafIndex`.
