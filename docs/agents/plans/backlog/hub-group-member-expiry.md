# Hub group-member expiry (ghost rosters)

**Origin:** deferred item 2c from `completed/2026-06-11-kubun-audit-boundary-fixes.complete.md`.

## Problem

Since `hub/group/join` now adds a durable member via `addGroupMember` and `removeGroupMember` (explicit leave) is the only removal, a member that never sends an explicit leave — crash, app uninstalled, lost device — stays in the persisted group roster forever. Every `hub/group/send` then queues a message for that ghost recipient. Cost/storage leak, not a correctness break (delivery to live members is unaffected).

## Direction

Add a `lastSeen`-style touch on member activity (join / receive-channel bind / ack) and a sweep that evicts members idle beyond a threshold. Tie the sweep to the existing retention scheduler rather than a standalone timer. Open question carried from the audit: what eviction threshold is safe given offline members must persist long enough to receive MLS commits on reconnect.

## Scope

`@enkaku/hub-protocol` (store interface — a per-member timestamp or a `touchGroupMember`), `@enkaku/hub-server` (sweep + activity touches). Coordinate threshold with kubun's offline-delivery expectations.
