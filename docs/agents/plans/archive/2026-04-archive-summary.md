# 2026-04 Archive Summary

## Plans Completed

- **group-ratchet-tree-null-safety** (2026-04-05, complete) -- Fixed null/undefined corruption in MLS ratchet trees through JSON serialization. `commitInvite` now sets `ratchetTreeExtension: true` to embed the tree in Welcome messages (eliminates separate tree transport). `processWelcome.ratchetTree` is optional; `sanitizeRatchetTree` utility maps `null` → `undefined` as a defensive fallback. Fixed `memberCount` null-safety. 18 new tests.

- **server-client-teardown-lifecycle** (2026-04-18, complete) -- Eliminated unhandled rejections in `@enkaku/server` + `@enkaku/client` teardown (originally surfaced by Kubun `HubRelayManager`). Added `isBenignTeardownError` classifier in `@enkaku/async` (matches `AbortError`, `DisposeInterruption`, closed-writer/reader patterns) and central `safeWrite` wrappers that swallow benign teardown errors and surface them as `writeDropped`. Introduced lifecycle event emitters on `Transport`, `Server`, `Client`.

- **hub-server-receive-double-bind** (2026-04-26, complete) -- `HubClientRegistry.setReceiveWriter` now throws on double-bind so a misbehaving client opening a second `hub/receive` for the same DID surfaces a loud error instead of silently overwriting the first writer. Two-layer defense: pre-check at handler + defensive throw in registry. New `isWriterBound(did)` method decouples the guard from `isOnline` semantics.
