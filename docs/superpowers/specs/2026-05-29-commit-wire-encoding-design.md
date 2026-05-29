# MLS Commit/Welcome Wire Encoding + Epoch Surface — Design

**Status:** spec
**Package:** `@enkaku/group`
**Date:** 2026-05-29
**Consumer:** Kubun — `kubun/docs/superpowers/specs/2026-05-28-mls-membership-apply-check-design.md` (path A revision)

## 1. Goal

Make `@enkaku/group` Commit and Welcome outputs **wire-ready** and **epoch-tagged** so consumers can route them through a Delivery Service (kubun's hub relay) to all existing group members, satisfying RFC 9750 §6.1:

> "MLS does not allow for or support addition or removal of group members without informing all other members."

Today `commitInvite` and `removeMember` return ts-mls in-memory objects (`commitMessage: unknown`, `welcomeMessage: unknown`); consumers cannot serialize them without reaching past the public API. The encoder *is* used internally — `joinGroupExternal` produces `commitMessage: Uint8Array` via `encode(mlsMessageEncoder, framedCommit)` (`packages/group/src/group.ts:624-629`) — it just isn't applied to the membership-mutation outputs.

## 2. Threat / use case

The consuming flow (kubun, but generalizes to any MLS deployment built on enkaku):

1. Admin calls `removeGroupMember(handle, leafIndex)`. Enkaku produces a Commit + new state.
2. Kubun must put the Commit on a wire (`hub/group/send` with `kind: 'mls'`).
3. The Commit must be ordered against other Commits — receivers compare its epoch tag to their local `handle.epoch` to decide drop / process / buffer (RFC 9750 §5.2.2 eventual-consistency model).
4. Receivers call `handle.processMessage(commitBytes)` to advance their epoch.

Steps 2–3 are blocked today: no exported bytes, no epoch tag on the result.

## 3. API changes

### 3.1 Wire-ready bytes on every commit/welcome producer

**`CommitInviteResult`** (`packages/group/src/group.ts:353-393`):

```ts
export type CommitInviteResult = {
  commitMessage: Uint8Array          // CHANGED: was `unknown`
  welcomeMessage: Uint8Array          // CHANGED: was `unknown`
  newGroup: GroupHandle
  epoch: bigint                       // NEW: epoch the commit was committed INTO (== newGroup.epoch)
}
```

**`RemoveMemberResult`** (`packages/group/src/group.ts:465-498`):

```ts
export type RemoveMemberResult = {
  commitMessage: Uint8Array          // CHANGED: was `unknown`
  newGroup: GroupHandle
  epoch: bigint                       // NEW
}
```

Implementation: `createCommit` (ts-mls) already returns framed results — no manual framing wrapper needed. `result.commit` is an `MlsFramedMessage` (defaulting to `MlsPrivateMessage` when `wireAsPublicMessage` is not set — neither `commitInvite` nor `removeMember` sets it, so commits are encrypted to the current epoch, correct for broadcast to existing members). `result.welcome` is an `MlsWelcomeMessage | undefined`. Encode each directly:

```ts
const commitMessage = encode(mlsMessageEncoder, result.commit)
if (result.welcome == null) {
  throw new Error('commitInvite: expected a Welcome message for the add proposal')
}
const welcomeMessage = encode(mlsMessageEncoder, result.welcome)
```

(Note: `joinGroupExternal` frames a *bare* `PublicMessage` returned by `mlsJoinGroupExternal` — a different call than `createCommit`. The `joinGroupExternal` encoding pattern is structurally similar, not literally reusable here. The earlier version of this spec implied otherwise; corrected.)

### 3.2 `GroupHandle.processMessage` accepts bytes OR decoded objects

Today `processMessage(privateMessage: unknown)` (group.ts:225) passes its argument straight to ts-mls `mlsProcessMessage`. ts-mls accepts decoded objects. With 3.1, consumers produce `Uint8Array`, so receivers will pass `Uint8Array` to `processMessage`.

Change: detect `Uint8Array` argument at the top of `processMessage` and `decode(mlsMessageDecoder, bytes)` before delegating. Pre-existing object inputs continue to work (back-compat for any internal/test callers; can be tightened later).

```ts
async processMessage(message: Uint8Array | unknown): Promise<Uint8Array | null> {
  const decoded = message instanceof Uint8Array
    ? decode(mlsMessageDecoder, message)
    : message
  const result = await mlsProcessMessage({ context: this.#context, state: this.#state, message: decoded })
  // ... existing body
}
```

Same treatment for `decrypt(privateMessage: unknown)` (group.ts:207) — accept `Uint8Array | unknown` for symmetry.

### 3.3 No new epoch accessor needed

`GroupHandle.epoch` (group.ts:120-122) already returns `this.#state.groupContext.epoch: bigint`. The `epoch` field on the commit results is derivable as `newGroup.epoch` and is added purely for ergonomic + serialization symmetry (so the caller can stamp the wire envelope without dereferencing `newGroup`).

## 4. Non-changes

- No new export. Encoders (`mlsMessageEncoder`, `mlsMessageDecoder`) stay internal — consumers receive `Uint8Array` and pass `Uint8Array` back. The public API remains opaque-bytes-in, opaque-bytes-out.
- No change to the proposal model. ts-mls bundles proposals into commits; this spec does not introduce standalone proposals.
- No change to `joinGroupExternal` — it already returns `commitMessage: Uint8Array` (group.ts:561), which becomes the consistency baseline this spec extends to membership ops.
- No change to `processWelcome` — Welcome is already accepted as opaque input by ts-mls; consumers can pass `Uint8Array` directly today (`decode` happens internally).

## 5. Breaking change & migration

`CommitInviteResult.commitMessage` and `welcomeMessage` change type from `unknown` to `Uint8Array`. `RemoveMemberResult.commitMessage` likewise. This is **semver-major** at the type level, but the runtime shape is strictly narrower than `unknown` so callers that used the values opaquely (passing them to `processMessage`, never inspecting fields) keep working at runtime. Internal kubun consumer (`packages/plugin-p2p/src/groups/manager.ts`) is the only known caller and updates in lockstep.

Bump `packages/group/package.json` 0.16.0 → 0.17.0. No enkaku-side `pnpm-workspace.yaml` catalog entry exists for `@enkaku/group` and no internal package consumes it — the catalog bump is kubun-side (see §8).

## 6. Testing

Extend `packages/group/test/group.test.ts`:

- `commitInvite` returns `commitMessage` + `welcomeMessage` as `Uint8Array`; the bytes decode back via `decode(mlsMessageDecoder, …)` to a structurally valid MLSMessage; `result.epoch === newGroup.epoch`.
- `removeMember` returns `commitMessage` as `Uint8Array`; `result.epoch === newGroup.epoch`.
- `processMessage(commitBytes)` (bytes form) advances the receiver's epoch exactly as `processMessage(decodedCommit)` (object form) did before.
- `processMessage(staleCommitBytes)` on a receiver already past that epoch throws (ts-mls rejection of wrong-epoch handshake — already covered by `external-rejoin.test.ts:95-96`; assert the same behaviour holds for bytes form).

## 7. Out of scope

- **Standalone proposals.** Add/Remove proposals as separate wire objects (decoupled from commits) are not modeled. ts-mls bundles them into commits; that's the only mode this spec supports.
- **Self-remove.** MLS forbids self-removal commits; no API added. Voluntary-leave is solved at the consumer layer (kubun spec §3 "Voluntary leave").
- **Hub/DS adapter.** Delivery, ordering, replay, and retention belong to the consumer's DS (kubun hub relay). Enkaku produces wire-ready bytes only.

## 8. Cross-repo coordination

- Land `@enkaku/group@0.17.0` first.
- Bump `kubun/pnpm-workspace.yaml` `@enkaku/group` catalog entry. `minimumReleaseAgeExclude: @enkaku/*` already in kubun's workspace bypasses release-age delay.
- Kubun's path-A wiring proceeds against the new bytes contract.
