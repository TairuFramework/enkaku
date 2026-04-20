# MLS External Rejoin (Stale Device Recovery)

**Status:** Spec — awaiting implementation plan
**Package:** `@enkaku/group`
**Origin:** Unblocks kubun `mls-external-join-stale-recovery` (kubun `docs/agents/plans/backlog/mls-external-join-stale-recovery.md`).

## Goal

Add MLS RFC 9420 external commit support to `@enkaku/group`, scoped to the **stale device self-rejoin** case: an existing member whose local MLS state has fallen behind on epochs rejoins the group fresh using only the group's published public state plus its previously-stored credential.

Not in scope (defer to follow-on specs):
- Fresh external join by a new DID with pre-delegated capability (no live inviter).
- `proposeAddExternal` flow (a member proposes adding an external party from a fetched key package).
- Distribution mechanism for `GroupInfo` (left to consumers — kubun will route via hub).

## Background

### Current state of `@enkaku/group`

The package wraps `ts-mls` to provide a credential-aware group lifecycle: `createGroup`, `createInvite` + `commitInvite` (inviter side), `processWelcome` (invitee side), `removeMember`, `restoreGroup`. All joins go through the invite/Welcome path. `GroupHandle` owns mutable `ClientState` and exposes `encrypt` / `decrypt` / `processMessage`.

### Why external rejoin matters

Each device keeps its own MLS leaf and ratchet state. When a device is offline long enough that the group has advanced past its current epoch (commits added/removed members, rotated keys), it can no longer decrypt application messages. Replaying every missed commit sequentially is bandwidth- and CPU-expensive and may not be possible if intermediate commits are no longer available.

RFC 9420 §11.2.1 defines an **external commit**: a non-member (or stale member) constructs a Commit containing an `external_init` proposal, using only the group's `GroupInfo` (which carries an `external_pub` extension). Members process this commit normally; the external joiner's leaf is added (with `resync: true`, the joiner's previous leaf for the same identity is also removed in the same commit, so the device replaces itself in one step).

### Underlying primitives already exist in `ts-mls`

- `createGroupInfoWithExternalPub(state, extensions, cs)` — produces `GroupInfo` containing `external_pub`.
- `createGroupInfoWithExternalPubAndRatchetTree(state, extensions, cs)` — same, with embedded ratchet tree (larger but self-contained).
- `joinGroupExternal({ context, groupInfo, keyPackage, privateKeys, resync, tree?, authenticatedData? })` — produces the public Commit + new `ClientState`.
- `groupInfoEncoder` / `groupInfoDecoder` (in `ts-mls/dist/src/groupInfo.d.ts`, not currently re-exported from the main barrel — accessible via deep import).
- Existing `mlsProcessMessage` already handles incoming external commits on the member side (no member-side change required).

So the work is wrapping these for `@enkaku/group`'s credential model and encode/decode boundary, not implementing the protocol.

## Trust model (this scope only)

Stale recovery means **same DID rejoins**. The rejoining device:

- Reuses its previously stored `MemberCredential` (DID + capability chain + permission). No new delegation required.
- Authenticates the external commit via its existing signing key (already in `OwnIdentity`).
- Uses `resync: true` so existing members atomically remove the rejoiner's old leaf in the same commit.

Members already validate commits against the sender's identity; nothing new on the member side. The capability chain proves the rejoiner is the same authorized member it was before.

Capability validation on rejoin: when reconstructing `GroupHandle` post-rejoin, `MemberCredential` is taken as-given from caller storage. We do **not** re-validate the chain in this code path — caller already validated when it was originally accepted (during `processWelcome`). Re-validation could be added later if storage tampering is in scope, but it's out of scope here.

## API additions

All in `packages/group/src/group.ts` unless noted.

### 1. `exportGroupInfo`

```ts
export type ExportGroupInfoParams = {
  group: GroupHandle
  /** Embed the ratchet tree in the GroupInfo. Default: true.
   *  When false, the external joiner must obtain the tree separately
   *  (e.g. via the ratchet_tree extension or a known peer).
   *  For stale-recovery use cases, true is almost always correct. */
  includeRatchetTree?: boolean
  extensions?: Array<GroupInfoExtension>
}

export type ExportGroupInfoResult = {
  /** Binary-encoded GroupInfo, ready for transport. */
  groupInfo: Uint8Array
}

export async function exportGroupInfo(
  params: ExportGroupInfoParams,
): Promise<ExportGroupInfoResult>
```

Wraps `createGroupInfoWithExternalPubAndRatchetTree` (default) or `createGroupInfoWithExternalPub` (when `includeRatchetTree: false`), then serializes via `groupInfoEncoder`.

Returns a binary blob so consumers can store / transmit without depending on `ts-mls` internal types. Any current member can call this; it's stateless w.r.t. group epoch advancement.

### 2. `joinGroupExternal`

```ts
export type JoinGroupExternalParams = {
  identity: OwnIdentity
  /** Binary GroupInfo from exportGroupInfo. */
  groupInfo: Uint8Array
  /** Caller's stored credential. Reused as-is — not re-validated.
   *  Must be a credential the caller previously held in this group. */
  credential: MemberCredential
  /** True for stale device recovery (removes prior leaf for same identity).
   *  This spec only supports resync: true; non-resync external join is out of scope. */
  resync: true
  options?: GroupOptions
  authenticatedData?: Uint8Array
}

export type JoinGroupExternalResult = {
  /** Public Commit message. Caller must broadcast this so other members
   *  process it and advance their state. */
  commitMessage: unknown
  /** Newly initialized GroupHandle at the post-commit epoch. */
  group: GroupHandle
}

export async function joinGroupExternal(
  params: JoinGroupExternalParams,
): Promise<JoinGroupExternalResult>
```

Internally:
1. Resolve `MlsContext` via existing `resolveMlsContext(options)`.
2. Decode `groupInfo` via `groupInfoDecoder`.
3. Generate a fresh key package for `identity` via `generateKeyPackageWithKey` (same as `createGroup` / `createKeyPackageBundle`).
4. Call `mls.joinGroupExternal({ context, groupInfo, keyPackage, privateKeys, resync: true, authenticatedData })`.
5. Wrap the resulting `ClientState` in a new `GroupHandle` with the supplied `credential` and `rootCapability` (taken from `credential.capabilityChain[0]`).
6. Return `{ commitMessage, group }`.

The caller is responsible for delivering `commitMessage` to other members. `@enkaku/group` does not assume a transport.

### 3. Codec re-exports

In `packages/group/src/codec.ts`, add re-exports:

```ts
export { groupInfoEncoder, groupInfoDecoder } from 'ts-mls'
// (or via deep import if not in ts-mls barrel — verify during impl)
```

These already cover the wire format. We avoid inventing a second envelope; consumers use the standard MLS encoding.

### 4. `GroupHandle` change

No new methods. `processMessage` already handles incoming external commits via `mlsProcessMessage`. The only verification needed is that processing an external commit returns successfully and advances state — covered in tests below.

## Public API surface (additions to `index.ts`)

```ts
export {
  // existing exports …
  exportGroupInfo,
  type ExportGroupInfoParams,
  type ExportGroupInfoResult,
  joinGroupExternal,
  type JoinGroupExternalParams,
  type JoinGroupExternalResult,
} from './group.js'

export { groupInfoEncoder, groupInfoDecoder } from './codec.js'
```

## Error behavior

- `exportGroupInfo`: propagates `ts-mls` errors as-is. No additional validation.
- `joinGroupExternal`:
  - Invalid `groupInfo` bytes → decoder error propagates as-is.
  - `credential.capabilityChain` empty → throw `Error('Invalid credential: capability chain must not be empty')` (mirrors existing `processWelcome` check).
  - `ts-mls.joinGroupExternal` failures (cipher mismatch, malformed GroupInfo, etc.) propagate as-is.
- Member side processing the commit: existing `GroupHandle.processMessage` error behavior; no change.

No new error types in this spec. Consumers wrap as needed.

## Testing

New file: `packages/group/test/external-rejoin.test.ts`.

### Test 1: stale device rejoin round trip

1. `createGroup` as A.
2. A invites B (`createInvite` + B's `createKeyPackageBundle` + `commitInvite` + B's `processWelcome`).
3. A advances epoch several times (e.g. invite + commit a third member C, then remove C). B does **not** process these commits — simulating offline.
4. Verify B's epoch < A's epoch and B's `decrypt` of an A-encrypted message fails.
5. A calls `exportGroupInfo` → binary blob.
6. B calls `joinGroupExternal({ identity: B_identity, groupInfo, credential: B_storedCredential, resync: true })`.
7. B's new `GroupHandle.epoch` matches A's epoch + 1 (the rejoin commit advances by one).
8. A processes B's `commitMessage` → A's `GroupHandle.epoch` matches B's.
9. A encrypts a new message → B decrypts it successfully. Round trip both directions.
10. A's ratchet tree contains exactly one leaf for B's DID (old one removed by `resync`).

### Test 2: ratchet tree omitted

Same as Test 1 but with `exportGroupInfo({ includeRatchetTree: false })` and **no separately-provided tree**. Expect `joinGroupExternal` to throw a clear error indicating the ratchet tree is required. (Supporting separate tree provision is out of scope — `joinGroupExternal` does not accept a tree parameter in this spec; consumers wanting that path should pass `includeRatchetTree: true`.)

### Test 3: empty credential chain rejected

Call `joinGroupExternal` with `credential.capabilityChain = []`. Expect the documented error.

### Test 4: third member observes rejoin

1. Group of A, B, C. C is online.
2. B goes stale, rejoins externally.
3. A processes B's commit. C also processes B's commit.
4. C can encrypt → both A and B decrypt.

Tests run under existing `vitest` config (`tsconfig.test.json`). Reuse helpers from `packages/group/test/group.test.ts` if present (key package generation, identity setup).

## Documentation

Update `packages/group/README.md` with a new section **"External rejoin (stale device recovery)"**:

- One-paragraph explanation of the problem (epoch staleness) and the fix (external commit).
- Code snippet showing `exportGroupInfo` on a healthy member + `joinGroupExternal` on the stale device.
- Trust-model note: stale rejoin reuses existing credential; no new delegation. Out-of-scope use cases (fresh external join with new DID, member-proposed external add) explicitly listed as "not yet supported."
- Note that callers own the transport for both `groupInfo` and `commitMessage`.

Also add a short entry to `packages/group/AGENTS.md` (if present, otherwise skip) pointing future agents at the new functions.

## Out of scope (explicit non-goals)

- **Fresh external join with a new DID.** Requires deciding how a non-member acquires a `MemberCredential` without a live inviter (pre-delegated cap stored where? validated when?). Defer to a follow-on spec when a concrete use case appears.
- **`proposeAddExternal`.** Member-initiated proposal to add an external party. Different flow, different API.
- **GroupInfo distribution.** Where the rejoiner gets the blob from is a consumer concern. Kubun will publish via hub; other consumers may use a directory service or DM.
- **Capability re-validation on rejoin.** Reuses caller-stored credential without re-checking the chain. Add later if storage-tampering threat model expands.
- **Stale-detection trigger.** When to attempt rejoin (decrypt failure? epoch lag threshold?) is a consumer concern.
- **Application-state rebuild.** Replaying broadcast history, Merkle sync, etc. is entirely consumer responsibility (kubun side: HLC+LWW + Merkle sync already exist).

## Risks and open questions

- **`groupInfoEncoder` reachability.** Confirmed in `ts-mls/dist/src/groupInfo.d.ts` but not in the main barrel. Implementation must verify the deep-import path is stable across ts-mls versions; if not, file an upstream re-export request and inline a copy meanwhile.
- **`resync: true` semantics with multiple stale leaves.** RFC 9420 says `resync` removes the joiner's prior leaf. If a single DID has multiple leaves (e.g. multiple devices), behavior must be confirmed. Add a test only if we discover this matters; for now, `@enkaku/group` is one-leaf-per-identity by convention.
- **External commit signature key.** The external commit is signed with the joiner's signature key, not the group key (the joiner has no group key yet). `OwnIdentity.privateKey` already provides this; verify `mls.joinGroupExternal` signs correctly with it.

## Success criteria

- Both new functions exported from `@enkaku/group/index.ts`.
- Test 1–4 pass under `pnpm test` from the package directory.
- README updated with the new section.
- A consuming kubun spec can call `exportGroupInfo` on the server side, ship the blob over the hub, and the stale device can call `joinGroupExternal` to rejoin without further enkaku changes.
