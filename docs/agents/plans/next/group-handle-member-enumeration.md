# GroupHandle Member Enumeration

**Priority:** next (blocks Kubun's MLS group-membership apply-time write check)
**Origin:** Downstream requirement from Kubun `feat/mls-membership-check` (spec `kubun/docs/superpowers/specs/2026-05-28-mls-membership-apply-check-design.md`). Surfaced during execution: the receive path cannot derive *who* a commit removed.

## Problem

A consumer (Kubun) needs to detect, on the **receive** side, which member DIDs an incoming MLS commit removed, so it can tombstone that member's local group-membership row (and later reject write mutations the removed member signed after their removal).

Today `GroupHandle` exposes:

- `findMemberLeafIndex(did): number | undefined` — DID → leaf index (forward lookup only).
- `memberCount: number` — count of leaf nodes.
- `state: ClientState` — full ratchet tree (consumers *could* hand-roll enumeration, but that leaks credential-parsing internals — `parseMLSCredentialIdentity`, `nodeTypes.leaf`, the `i / 2` leaf-index convention — into every consumer).

ts-mls `processMessage()` returns only `{ kind, newState, actionTaken, consumed, aad }` — **no membership diff, no removed-leaf indices**. So a consumer cannot ask the commit "who did you remove?" The only reliable signal is to **enumerate members before and after** applying the commit and diff the two sets.

There is no inverse (leaf index → DID) accessor and no "list all members" accessor. Without one, every consumer reimplements the `findMemberLeafIndex` ratchet-tree walk.

## Proposed API

Add a read-only member-enumeration accessor to `GroupHandle`, mirroring the existing `findMemberLeafIndex` walk but collecting every leaf:

```ts
type GroupMember = {
  leafIndex: number   // MLS leaf index (tree position / 2, matching findMemberLeafIndex)
  did: string         // parsed from the leaf's MLS credential identity
}

class GroupHandle {
  /**
   * Enumerate the group's current members from the ratchet tree. Leaves whose
   * credential identity fails to parse are skipped (same tolerance as
   * findMemberLeafIndex). Reflects the handle's current #state — call before
   * and after processMessage to diff a commit's membership change.
   */
  listMembers(): Array<GroupMember>
}
```

Implementation: factor the leaf-walk currently inlined in `findMemberLeafIndex` (`group.ts:153-172`) into a shared private iterator; `findMemberLeafIndex` and `listMembers` both consume it. No new ts-mls calls, no state mutation — pure read over `this.#state.ratchetTree`.

### Consumer usage (Kubun roster-diff, for context only — not built here)

```ts
const before = new Set(handle.listMembers().map((m) => m.did))
await handle.processMessage(commit)        // mutates #state to the post-commit roster
const after = new Set(handle.listMembers().map((m) => m.did))
const removed = [...before].filter((did) => !after.has(did))
// Kubun: removed.forEach((did) => store.markMemberRemoved(groupID, did, localHLC))
```

## Scope

- **In:** `listMembers()` accessor + shared leaf-iterator refactor; unit test asserting it enumerates all members of a multi-member group, reflects adds/removes after `processMessage`, and skips unparseable leaves. Export `GroupMember` type from `index.ts`.
- **Out:** the diff itself, HLC stamping, and store writes — those live in the consumer (Kubun). No change to `processMessage`'s signature or return type. No commit-introspection API (deliberately avoided — pre/post enumeration is the robust primitive; parsing proposal lists out of a commit is fragile and ts-mls does not surface them).

## Notes

- Leaf-index convention: `findMemberLeafIndex` returns `i / 2` (ratchet-tree array index → leaf index). `listMembers` must use the same convention so the two agree.
- `decrypt()` throws on a handshake (commit) message but updates `#state` first; `processMessage()` is the non-throwing variant returning `null` for handshakes. The consumer's pre/post diff works with either as long as `#state` is advanced — document that `listMembers()` reads post-advance state.
- Credential parsing already tolerates non-DID/garbage leaves (`findMemberLeafIndex` `continue`s on parse failure); `listMembers` keeps that tolerance rather than throwing, so one malformed leaf cannot break enumeration.
- Cross-repo coordination: Kubun's Phase 2 (`mls-membership-apply-check` plan, Q2.3/Q2.4) consumes this. Land + publish here first, then Kubun bumps the `@enkaku/group` dependency.
