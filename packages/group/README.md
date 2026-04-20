# @enkaku/group

Credential-aware MLS (RFC 9420) group lifecycle for enkaku. Wraps [`ts-mls`](https://github.com/LukaJCB/ts-mls) with DID-based capabilities, giving every member a `MemberCredential` that ties their MLS leaf to a signed capability chain.

## Capabilities

- `createGroup` — admin creates a new group with themselves as sole member
- `createInvite` + `commitInvite` — admin delegates a capability and produces the MLS Commit + Welcome
- `processWelcome` — invitee joins after validating the capability chain
- `removeMember` — admin evicts a leaf and rotates keys
- `restoreGroup` — rehydrate a `GroupHandle` from persisted `ClientState`
- `exportGroupInfo` + `joinGroupExternal` — stale-device self-rejoin (see below)

## External rejoin (stale device recovery)

Each device owns its MLS leaf and ratchet state. A device that stays offline long enough for the group to advance epochs (adds, removes, key rotations) can no longer decrypt current application messages. Replaying every missed commit sequentially is expensive and may be impossible if intermediate commits are no longer available.

RFC 9420 §11.2.1 defines an external commit: a non-member (or stale member) builds a Commit using only the group's `GroupInfo` (carrying an `external_pub` key). `@enkaku/group` wraps this for the stale-member case — same DID, cached `MemberCredential`, `resync: true` so the joiner's old leaf is removed in the same commit.

```ts
// On any healthy member (online, current epoch):
import { exportGroupInfo } from '@enkaku/group'
const { groupInfo } = await exportGroupInfo({ group: aliceGroup })
// groupInfo is a Uint8Array framed as MLSMessage(GroupInfo). Ship it to the stale device.

// On the stale device:
import { joinGroupExternal } from '@enkaku/group'
const { commitMessage, group } = await joinGroupExternal({
  identity: bob,                    // OwnIdentity from @enkaku/token
  groupInfo,                        // bytes received from the healthy member
  credential: bobStoredCredential,  // cached from the original processWelcome
  resync: true,
})
// Broadcast commitMessage (Uint8Array) to the other members; each decodes and calls
// group.processMessage(decoded). The returned `group` is already at the post-commit
// epoch — ready to encrypt/decrypt.
```

### Trust model

Stale rejoin reuses the caller's previously accepted credential. The capability chain is **not** re-validated during `joinGroupExternal` — we trust what the caller already stored from `processWelcome`. Existing members validate the commit sender's identity as part of normal MLS processing.

### Transport

`@enkaku/group` ships bytes, not channels. Callers own:
- Delivering `groupInfo` bytes from a healthy member to the stale device (e.g. via a hub, directory service, or DM).
- Broadcasting `commitMessage` bytes to every other member.
- Rebuilding application state (message backlog, per-member projections) — enkaku does not replay missed application messages.

### Not yet supported

- **Fresh external join by a new DID.** Requires deciding how a non-member acquires a `MemberCredential` without a live inviter.
- **Member-proposed external add.** `proposeAddExternal` is not wrapped yet.
- **Non-resync external join.** Only `resync: true` is supported.

### ⚠️ Security: removal is not revocation

MLS has no cryptographic member revocation. A device that retains its `MemberCredential` can rejoin via `joinGroupExternal` **even after being removed from the group**, provided it can still obtain a fresh `GroupInfo`. Consumers must assume a removed member can rejoin until capability-level revocation lands in a follow-up spec. Mitigations available today:

- Rotate the group: create a new group, migrate non-removed members via fresh invites, abandon the old group.
- Enforce access control outside MLS: block the removed device at the transport layer (e.g. hub auth).

The follow-up capability-revocation work will introduce signed `RevokeMember` tokens synced via a GroupContext extension, with member-side enforcement in `processMessage`.
