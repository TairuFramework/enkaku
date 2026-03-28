# Agent Primitives

**Status:** complete
**Completed:** 2026-03-28
**Branch:** `feat/mailbox`

## Goal

Provide Enkaku-level primitives for multi-device communication, service delegation, and person-to-person interaction via a blind relay hub with mailbox semantics.

## Key Design Decisions

- **Progressive trust model** — devices start self-sovereign (no root identity required). A Ledger root can be added later via re-parenting (delegation to existing device DID), not migration. Service delegation requires a root identity; device-to-device communication does not.
- **Hub as blind relay** — the hub sees only minimal routing metadata (sender DID, recipient DIDs, opaque payload). No content type, epoch, or application-level fields. This keeps Enkaku's relay layer independent of MLS or any specific encryption scheme.
- **Two send procedures** — `hub/send` for explicit recipient list, `hub/group/send` for group routing (hub resolves members). Clear separation of routing intent. Group send fails on unknown groups.
- **Channel-based receive with ack** — `hub/receive` is a bidirectional channel (not a stream). Hub pushes message batches, device pushes acks. Messages are not purged until acked. Supports `groupIDs` filter (direct messages always pass through).
- **Storage abstraction** — `HubStore` interface with store/fetch/ack/purge methods. Enkaku provides in-memory implementation for testing; real backends (SQLite, Postgres, etc.) are consumer-provided. Reference counting: message stored once, delivery tracked per recipient.
- **Revocation as VerifyTokenHook** — `createRevocationChecker(backend)` returns a function matching the existing `VerifyTokenHook` signature, plugging directly into `DelegationChainOptions.verifyToken`. No new verification path needed.
- **Root adoption via existing createCapability** — no new primitives needed. The Ledger signs a capability delegating to the device DID. Application layer (Kubun) decides when to present the delegation chain.
- **Enkaku owns primitives, not workflows** — data archival, recovery, state sync, known-devices list, and MLS epoch key backup are explicitly out of scope (Kubun concerns).

## What Was Built

- **`@enkaku/hub-protocol`** — Replaced `RoutedMessage` with opaque `StoredMessage`. New `HubStore` interface with pagination (cursor-based fetch, `hasMore`), explicit ack, reference counting, and purge with `EventEmitter` events. Protocol: `hub/send` (explicit recipients), `hub/group/send` (group routing), `hub/receive` (channel with ack + groupIDs filter). Removed `hub/tunnel/request`.
- **`@enkaku/hub-server`** — Rewritten memory store with sequence IDs (monotonically ordered), per-recipient delivery records, reference counting, and age-based purge. Registry simplified (tunnel support removed). Channel-based receive handler with queued message drain, ack processing, and group filter.
- **`@enkaku/hub-client`** — Updated API: `send()`, `groupSend()`, `receive()` (channel with optional filter), `joinGroup()`, `leaveGroup()`, key package methods.
- **`@enkaku/capability`** — Added `RevocationRecord` type, `RevocationBackend` interface, `createMemoryRevocationBackend()`, `createRevocationChecker()` factory, `createRevocationRecord()` helper.
- **Integration tests** — 16 tests covering: blind relay, store-and-forward, pagination, ack semantics, group fan-out, unknown group rejection, groupIDs filter, mixed delivery, delegation chains, scoped delegation, expiry, revocation, purge, and reference counting.
