# Group Ratchet Tree Null Safety

**Status:** complete
**Completed:** 2026-04-05
**Branch:** `fix/group-ratchet-tree-null-safety`

## Goal

Fix null/undefined corruption when MLS ratchet trees pass through JSON serialization, and eliminate the need for separate ratchet tree transport in the invite flow.

## Key Design Decisions

- **Root cause: JSON serialization converts `undefined` to `null`** — The MLS ratchet tree type `(Node | undefined)[]` uses `undefined` for blank nodes. When serialized as JSON (e.g. Kubun's invite payloads), these become `null`, which crashes ts-mls's strict `=== undefined` checks internally.
- **Ratchet tree extension as primary fix** — `commitInvite` now sets `ratchetTreeExtension: true` on `createCommit`, embedding the tree directly in the Welcome message using ts-mls's own binary codec. `processWelcome` no longer requires a `ratchetTree` parameter — `joinGroup` extracts the tree from the Welcome. This eliminates separate tree transport and the JSON serialization problem entirely.
- **Sanitizer as defensive layer** — `sanitizeRatchetTree` normalizes `null` → `undefined` at the `processWelcome` boundary for callers that still pass a tree explicitly. Belt-and-suspenders: the extension handles the common case, the sanitizer handles the fallback.
- **ts-mls codec not accessible** — `ratchetTreeEncoder`/`ratchetTreeDecoder` exist in ts-mls internals but are not in the public API (package.json `exports` map blocks subpath imports). The extension approach avoids this limitation.

## What Was Built

- **`@enkaku/group` — `commitInvite`** — Added `ratchetTreeExtension: true` to embed ratchet tree in Welcome messages.
- **`@enkaku/group` — `processWelcome`** — `ratchetTree` parameter is now optional. When provided, it's sanitized; when omitted, `joinGroup` uses the tree from the Welcome.
- **`@enkaku/group` — `memberCount`** — Fixed `!== undefined` to `!= null` for null-safe tree iteration.
- **`@enkaku/group` — `sanitizeRatchetTree`** — New utility in `codec.ts`, exported from package index. Maps `null` entries back to `undefined` for trees that have been through JSON roundtrips.
- **Test coverage** — 18 new tests: ratchet tree extension joins (2-member, 3-member), JSON null-safety scenarios (2-member, 3-member, post-removal, findMemberLeafIndex), sanitizer unit tests.
