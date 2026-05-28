# GroupHandle Member Enumeration — Design

**Date:** 2026-05-28
**Status:** Approved, ready for implementation plan
**Priority:** next (blocks Kubun's MLS group-membership apply-time write check)
**Origin:** Downstream requirement from Kubun `feat/mls-membership-check` (spec `kubun/docs/superpowers/specs/2026-05-28-mls-membership-apply-check-design.md`). Surfaced during execution: the receive path cannot derive *who* a commit removed.

## Problem

A consumer (Kubun) needs to detect, on the **receive** side, which member DIDs an incoming MLS commit removed, so it can tombstone that member's local group-membership row (and later reject write mutations the removed member signed after their removal).

Today `GroupHandle` exposes:

- `findMemberLeafIndex(id): number | undefined` — DID → leaf index (forward lookup only).
- `memberCount: number` — count of leaf nodes.
- `state: ClientState` — full ratchet tree (consumers *could* hand-roll enumeration, but that leaks credential-parsing internals — `parseMLSCredentialIdentity`, `nodeTypes.leaf`, the `i / 2` leaf-index convention — into every consumer).

ts-mls `processMessage()` returns only `{ kind, newState, actionTaken, consumed, aad }` — **no membership diff, no removed-leaf indices**. A consumer cannot ask the commit "who did you remove?" The only reliable signal is to **enumerate members before and after** applying the commit and diff the two sets.

There is no inverse (leaf index → DID) accessor and no "list all members" accessor. Without one, every consumer reimplements the `findMemberLeafIndex` ratchet-tree walk.

## Decisions

Resolved during brainstorming:

1. **Field name is `id`, not `did`.** Matches `MLSCredentialIdentity.id`, `parsed.id`, and the `findMemberLeafIndex(id)` parameter. The package uses `id` for all identity *values*; `DID` appears only in type names (`DIDResolver`, `DIDCache`). `GroupMember` keeps the value-field convention.
2. **Capability revocation is out of scope.** `mls-capability-revocation.md` is backlog, design still open (3 candidate designs, unresolved questions on permanence / re-admission / distribution). It is a write-path enforcement concern; this is read-only enumeration. Shipping enumeration first gives revocation a primitive to build on later, but they are not dependencies and are not coupled here. See *Future work*.
3. **Refactor via a private generator** (`#iterateMembers`), not an eager collector. Preserves `findMemberLeafIndex`'s current early-return on first match — no full-array build for a forward lookup.

## Design

### `GroupMember` type

Defined in `credential.ts`, alongside `MLSCredentialIdentity`:

```ts
export type GroupMember = {
  /** MLS leaf index (ratchet-tree array position / 2, matching findMemberLeafIndex). */
  leafIndex: number
  /** DID parsed from the leaf's MLS credential identity. */
  id: string
}
```

### `#iterateMembers()` — shared private generator

On `GroupHandle`. Single source of truth for the leaf-walk, credential parse, `i / 2` leaf-index convention, and skip-on-parse-failure tolerance currently inlined in `findMemberLeafIndex` (`group.ts:153-172`):

```ts
*#iterateMembers(): Generator<GroupMember> {
  const tree = this.#state.ratchetTree
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

### `findMemberLeafIndex` — refactored to consume the generator

```ts
findMemberLeafIndex(id: string): number | undefined {
  const targetNorm = normalizeDID(id)
  for (const member of this.#iterateMembers()) {
    if (normalizeDID(member.id) === targetNorm) return member.leafIndex
  }
  return undefined
}
```

Behaviour unchanged: same return values, same early-return on first match, same parse tolerance.

### `listMembers()` — new public accessor

```ts
/**
 * Enumerate the group's current members from the ratchet tree, in ascending
 * leaf-index order. Leaves whose credential identity fails to parse are skipped
 * (same tolerance as findMemberLeafIndex). Reflects the handle's current #state
 * — call before and after processMessage to diff a commit's membership change.
 */
listMembers(): Array<GroupMember> {
  return [...this.#iterateMembers()]
}
```

Pure read over `this.#state.ratchetTree`. No new ts-mls calls, no state mutation.

### Exports

Add `GroupMember` to `index.ts`, exported from `./credential.js`.

## Consumer usage (Kubun roster-diff — context only, not built here)

```ts
const before = new Set(handle.listMembers().map((m) => m.id))
await handle.processMessage(commit)        // mutates #state to the post-commit roster
const after = new Set(handle.listMembers().map((m) => m.id))
const removed = [...before].filter((id) => !after.has(id))
// Kubun: removed.forEach((id) => store.markMemberRemoved(groupID, id, localHLC))
```

## Testing

Unit test (`group.test.ts` or co-located new file):

- Multi-member group → `listMembers()` enumerates all members, ascending `leafIndex`.
- After an add committed via `processMessage`, the new member appears.
- After a remove committed via `processMessage`, the removed member is gone.
- A leaf with unparseable credential identity is skipped, not thrown.
- `findMemberLeafIndex` still returns correct indices after the refactor (regression).

## Scope

- **In:** `GroupMember` type; `#iterateMembers` private generator; `findMemberLeafIndex` refactor onto it; `listMembers()` public accessor; export `GroupMember` from `index.ts`; unit tests above.
- **Out:** the diff itself, HLC stamping, store writes — consumer (Kubun) territory. No change to `processMessage` signature or return type. No commit-introspection API (pre/post enumeration is the robust primitive; parsing proposal lists from a commit is fragile and ts-mls does not surface them). Capability revocation (separate backlog plan).

## Notes

- **Leaf-index convention:** generator yields `i / 2` (ratchet-tree array index → leaf index), so `listMembers` and `findMemberLeafIndex` agree.
- **State-advance timing:** `decrypt()` throws on a handshake (commit) message but updates `#state` first; `processMessage()` is the non-throwing variant returning `null` for handshakes. The consumer's pre/post diff works with either as long as `#state` is advanced — `listMembers()` reads post-advance state.
- **Parse tolerance:** credential parsing already tolerates non-DID/garbage leaves (`findMemberLeafIndex` `continue`s on parse failure); the generator keeps that tolerance, so one malformed leaf cannot break enumeration.
- **Cross-repo coordination:** Kubun's Phase 2 (`mls-membership-apply-check` plan, Q2.3/Q2.4) consumes this. Land + publish here first, then Kubun bumps the `@enkaku/group` dependency.

## Future work

`mls-capability-revocation.md` (backlog) is a downstream consumer of this primitive: its member-side enforcement hook in `processMessage` can enumerate the ratchet tree via the same walk to validate adds against a banlist. Not built here; deserves its own brainstorm given its open design space.
