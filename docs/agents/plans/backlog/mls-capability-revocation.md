# MLS Capability-Layer Member Revocation

**Priority:** backlog (blocks fresh external join with new DID; needed to close stale-rejoin security gap)
**Origin:** Follow-up to `2026-04-20-mls-external-rejoin.complete.md`

## Problem

MLS (RFC 9420) has no cryptographic member revocation. `joinGroupExternal({ resync: true })` lets any device that retains its `MemberCredential` rejoin the group after removal, provided it can still obtain a fresh `GroupInfo`. Today's mitigations are external-to-MLS (group rotation, transport-layer deny-serve). A capability-layer revocation mechanism is needed for production use cases that require guaranteed eviction.

## Sketch

Candidate designs (to be brainstormed):

1. **Capability revocation tokens** — Admin signs `RevokeMember{ groupID, revokedDID, epoch }` cap token. Members persist a revocation set per group. On `processMessage` for commits with add/external-init proposals, reject if the added leaf DID has a valid revocation token. Distribution mechanism needs deciding (piggyback on commits, separate channel, hub broadcast).

2. **GroupContext extension banlist** — Admin puts `bannedDIDs: Array<DID>` in a custom GroupContext extension. Syncs natively via MLS state. Member-side hook in `processMessage` rejects commits adding revoked DIDs. Simpler distribution, unbounded extension growth.

3. **Hybrid** — Signed revocation token stored in GroupContext extension. Best of both: cryptographic verification + MLS-native convergence.

## Dependencies

- Unblocks `proposeAddExternal` and fresh external join (non-resync) once the revocation story is in place.

## Notes

- Member-side enforcement hook lives in `GroupHandle.processMessage` — likely a small validator that runs before `mlsProcessMessage` and rejects adds of revoked DIDs.
- Need to decide: is revocation permanent or per-epoch? Can a revoked DID be re-admitted (fresh delegation resets the ban)?
- Late-joining members need to fetch the revocation set on join — design that into the Welcome or its distribution envelope.
