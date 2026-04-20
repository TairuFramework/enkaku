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
}

export type ExportGroupInfoResult = {
  /** Framed MLSMessage(GroupInfo) bytes per RFC 9420 §6.1 (wireformat = mls_group_info).
   *  Self-describing: includes ProtocolVersion + WireFormat + GroupInfo. Ratchet tree
   *  is always embedded (no opt-out in this scope). */
  groupInfo: Uint8Array
}

export async function exportGroupInfo(
  params: ExportGroupInfoParams,
): Promise<ExportGroupInfoResult>
```

Wraps `createGroupInfoWithExternalPubAndRatchetTree`, then serializes via the framed `mlsGroupInfoEncoder` (deep import from `ts-mls/dist/src/message.js` — internal; not re-exported).

Returns a binary blob so consumers can store / transmit without depending on `ts-mls` internal types. Any current member can call this; it's stateless w.r.t. group epoch advancement.

### 2. `joinGroupExternal`

```ts
export type JoinGroupExternalParams = {
  identity: OwnIdentity
  /** Framed MLSMessage(GroupInfo) bytes from exportGroupInfo. */
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
  /** Framed MLSMessage(PublicMessage) bytes. Caller must broadcast so other
   *  members advance their state. Drop-in input to their processMessage path
   *  once decoded. */
  commitMessage: Uint8Array
  /** Newly initialized GroupHandle at the post-commit epoch. */
  group: GroupHandle
}

export async function joinGroupExternal(
  params: JoinGroupExternalParams,
): Promise<JoinGroupExternalResult>
```

Internally:
1. Resolve `MlsContext` via existing `resolveMlsContext(options)`.
2. Decode `groupInfo` bytes via framed `mlsGroupInfoDecoder` → unwrap inner `GroupInfo` struct.
3. Generate a fresh key package for `identity` via `generateKeyPackageWithKey` (same as `createGroup` / `createKeyPackageBundle`).
4. Call `mls.joinGroupExternal({ context, groupInfo, keyPackage: keyPackage.publicPackage, privateKeys: keyPackage.privatePackage, resync: true, authenticatedData })`.
5. Wrap the returned `publicMessage: PublicMessage` in an `MlsPublicMessage` (framed with ProtocolVersion + WireFormat) and encode to bytes.
6. Wrap the resulting `ClientState` in a new `GroupHandle` with the supplied `credential` and `rootCapability` (taken from `credential.capabilityChain[0]`).
7. Return `{ commitMessage: encodedBytes, group }`.

The caller is responsible for delivering `commitMessage` bytes to other members. `@enkaku/group` does not assume a transport.

### 3. Codec handling (internal)

No public codec re-exports. Encoder/decoder used internally in `packages/group/src/group.ts` via deep imports from `ts-mls/dist/src/message.js` (framed `mlsGroupInfoEncoder` / `mlsGroupInfoDecoder`) and `ts-mls/dist/src/publicMessage.js` if needed for framing the external commit.

Public API traffics only `Uint8Array`. Consumers never touch ts-mls internal types. An integration test round-trips `exportGroupInfo` → `joinGroupExternal` to catch deep-import path breakage on ts-mls upgrades (any silent rename fails this test).

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
```

No codec exports. Consumers interact via `Uint8Array` only.

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

### Test 2: empty credential chain rejected

Call `joinGroupExternal` with `credential.capabilityChain = []`. Expect the documented error.

### Test 3: third member observes rejoin

1. Group of A, B, C. C is online.
2. B goes stale, rejoins externally.
3. A processes B's commit. C also processes B's commit.
4. C can encrypt → both A and B decrypt.

### Test 4: codec round-trip (ts-mls upgrade guard)

Encode a GroupInfo via internal `mlsGroupInfoEncoder` → decode via `mlsGroupInfoDecoder` → assert structural equality on key fields (epoch, groupID, external_pub presence). Fails loudly if ts-mls deep-import paths break on upgrade.

Tests run under existing `vitest` config (`tsconfig.test.json`). Reuse helpers from `packages/group/test/group.test.ts` if present (key package generation, identity setup).

## Documentation

Update `packages/group/README.md` with a new section **"External rejoin (stale device recovery)"**:

- One-paragraph explanation of the problem (epoch staleness) and the fix (external commit).
- Code snippet showing `exportGroupInfo` on a healthy member + `joinGroupExternal` on the stale device.
- Trust-model note: stale rejoin reuses existing credential; no new delegation. Out-of-scope use cases (fresh external join with new DID, member-proposed external add) explicitly listed as "not yet supported."
- Note that callers own the transport for both `groupInfo` and `commitMessage`.
- **Security warning — removal is not revocation.** MLS has no cryptographic member revocation. A device that retains its `MemberCredential` can rejoin via `joinGroupExternal` even after being removed from the group, provided it can still obtain a fresh `GroupInfo`. Consumers MUST assume a removed member can rejoin until capability-level revocation ships (follow-up spec). Mitigations available today: rotate the group (create new group, migrate non-removed members) or enforce access control outside MLS (network-level block at transport).

Also add a short entry to `packages/group/AGENTS.md` (if present, otherwise skip) pointing future agents at the new functions.

## Out of scope (explicit non-goals)

- **Fresh external join with a new DID.** Requires deciding how a non-member acquires a `MemberCredential` without a live inviter (pre-delegated cap stored where? validated when?). Defer to a follow-on spec when a concrete use case appears.
- **`proposeAddExternal`.** Member-initiated proposal to add an external party. Different flow, different API.
- **GroupInfo distribution.** Where the rejoiner gets the blob from is a consumer concern. Kubun will publish via hub; other consumers may use a directory service or DM.
- **Capability re-validation on rejoin.** Reuses caller-stored credential without re-checking the chain. Add later if storage-tampering threat model expands.
- **Stale-detection trigger.** When to attempt rejoin (decrypt failure? epoch lag threshold?) is a consumer concern.
- **Application-state rebuild.** Replaying broadcast history, Merkle sync, etc. is entirely consumer responsibility (kubun side: HLC+LWW + Merkle sync already exist).
- **Member revocation.** MLS has no native revocation; `resync: true` lets any holder of a stored credential rejoin. A follow-up spec must define capability-layer revocation — likely a signed `RevokeMember{ groupID, revokedDID, epoch }` token distributed via a GroupContext extension banlist (synced natively by MLS) with member-side enforcement hook in `processMessage` that rejects adds for revoked DIDs. Needed before "fresh external join with new DID" is viable.

## Risks and open questions

- **Codec deep-import stability.** `mlsGroupInfoEncoder`/`mlsGroupInfoDecoder` live at `ts-mls/dist/src/message.js`, not in the main barrel. Implementation imports deeply; Test 4 guards against silent renames on upgrade. If upstream moves the symbols, we file an upstream re-export request and inline a copy meanwhile.
- **`resync: true` semantics with multiple stale leaves.** RFC 9420 says `resync` removes the joiner's prior leaf. If a single DID has multiple leaves (e.g. multiple devices), behavior must be confirmed. Add a test only if we discover this matters; for now, `@enkaku/group` is one-leaf-per-identity by convention.
- **External commit signature key.** The external commit is signed with the joiner's signature key, not the group key (the joiner has no group key yet). `OwnIdentity.privateKey` already provides this; verify `mls.joinGroupExternal` signs correctly with it.
- **PublicMessage framing path.** ts-mls returns raw `PublicMessage` from `joinGroupExternal`; we frame as `MlsPublicMessage` and encode. Verify the framed bytes are accepted by `mlsProcessMessage` on other members (Test 1 step 8 covers this).

## Success criteria

- Both new functions exported from `@enkaku/group/index.ts`.
- Test 1–4 pass under `pnpm test` from the package directory.
- README updated with the new section.
- A consuming kubun spec can call `exportGroupInfo` on the server side, ship the blob over the hub, and the stale device can call `joinGroupExternal` to rejoin without further enkaku changes.
