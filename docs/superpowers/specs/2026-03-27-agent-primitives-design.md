# Agent Primitives — Design Spec

**Date:** 2026-03-27

**Status:** approved

**Scope:** Enkaku-level primitives to support multi-device, service delegation, and person-to-person communication. Higher-level concerns (data archival, recovery, state sync, full delegation UX) belong to Kubun and other consumers.

---

## Context

Enkaku is an RPC framework. Its messages are transient — request/response, streams, channels. It does not own persistence or application state. But projects built on Enkaku (notably Kubun) need primitives for:

- **Multi-device:** A user's phone and laptop communicating via a blind relay
- **Service delegation:** A root identity granting scoped capabilities to always-on services (AI agents, bots)
- **Person-to-person:** Direct communication between users and cross-user delegation

Enkaku's role is providing the primitive toolkit — delegation chains, encrypted envelopes, blind relay — not implementing full workflows.

## Trust Model

### Progressive trust — no root required upfront

1. **Day 1:** User installs an app. The device generates its own keypair and DID. It is self-sovereign.
2. **Adding a peer device (no root):** Devices discover each other via shared secret (QR code, numeric code). They exchange DIDs and add each other to a local known-devices list. No delegation chain, no hierarchy. Either device can revoke by removing the other from its local list.
3. **Adding a root identity:** User connects a Ledger (or equivalent hardware wallet). The Ledger issues a delegation capability to the existing device DID — re-parenting, not migration. The device DID stays the same; it now has a chain proving the root authorizes it.
4. **Adding more devices (with root):** New device generates its own keypair. Ledger issues a delegation directly to it. Both devices have chains back to the same root.
5. **Service delegation (requires root):** Root identity issues a scoped, time-limited delegation to a service DID. Third parties can verify the chain. Not possible without a root — device-as-root trust isn't transferable.

### What changes at each level

| Capability | No root | With root |
|---|---|---|
| Device-to-device communication | Yes (known-devices list, hub mailbox) | Yes |
| MLS group membership | Each device is a separate member | Each device is a separate member |
| Delegate to services | No | Yes (delegation chain) |
| Third-party verifiable identity | No (self-sovereign only) | Yes (chain to root) |
| Cross-user delegation | No | Yes (root delegates to other user's DID) |

---

## 1. Hub Receive Channel

Replace the current `hub/receive` stream with a `hub/receive` channel procedure.

### Rationale

The hub is a blind relay. It stores and delivers opaque encrypted blobs without understanding their contents. Devices need paginated retrieval and explicit acknowledgment — the hub must not delete messages until the device confirms receipt.

A channel (bidirectional) is the right primitive: hub pushes message batches, device pushes acks. Similar to TCP's ack model.

### Protocol

**`hub/receive` (channel):**

- **Device opens channel** with optional `after` cursor (sequence ID) to resume from a previous position, and optional `groupIDs` filter to receive only messages from specific groups.
- **Hub -> device:** pushes batches of messages. Each message has a `sequenceID`, `senderDID`, and opaque `payload`.
- **Device -> hub:** pushes ack messages referencing sequence IDs. Hub marks those deliveries as complete.
- **Flow control:** Hub sends a batch, waits for ack before sending the next. Device controls pace.
- **Real-time:** After draining queued messages, the channel stays open. New messages are pushed as they arrive.

**`hub/send` (request) — explicit recipients:**

Send an opaque message to one or more explicit recipients by DID.

```
hub/send input:
  recipients: Array<string>   -- one or more recipient DIDs
  payload: Uint8Array          -- opaque encrypted blob
```

**`hub/group/send` (request) — group routing:**

Send an opaque message to all members of a group. The hub resolves the group's member roster and fans out. Fails if the group is unknown to the hub (no members have joined).

```
hub/group/send input:
  groupID: string              -- group to deliver to
  payload: Uint8Array          -- opaque encrypted blob
```

For both procedures, `senderDID` is NOT caller-provided. The hub server sets it from the authenticated token's issuer. This prevents sender spoofing.

### Message shape

The hub sees minimal metadata for routing. No content type, no epoch, no application-level fields.

```
hub/receive input:
  after?: string             -- cursor to resume from
  groupIDs?: Array<string>   -- only receive messages from these groups (hub/group/send only)

hub/receive message (hub -> device):
  sequenceID: string       -- assigned by hub, monotonically ordered
  senderDID: string
  groupID?: string         -- present for messages sent via hub/group/send
  payload: Uint8Array
```

Sequence IDs are opaque to consumers. The hub assigns them on receipt to provide consistent global ordering for pagination.

### Breaking change: `hub/receive` stream to channel

The current `hub/receive` stream procedure is replaced with a channel procedure. The name is preserved but the semantics change from server-push-only to bidirectional (hub pushes messages, device pushes acks). The hub server has not been released — breaking changes are acceptable.

---

## 2. HubStore Interface

The `HubStore` interface is the abstraction for durable message storage. Enkaku defines the contract and provides an in-memory implementation for testing. Real backends (SQLite, Postgres, S3, etc.) are plugged in by consumers.

### API

```typescript
type StoreParams = {
  senderDID: string
  recipients: Array<string>
  payload: Uint8Array
}

type FetchParams = {
  recipientDID: string
  after?: string
  limit?: number
  ack?: Array<string>
}

type FetchResult = {
  messages: Array<{
    sequenceID: string
    senderDID: string
    payload: Uint8Array
  }>
  cursor: string | null
  hasMore?: boolean
}

type AckParams = {
  recipientDID: string
  sequenceIDs: Array<string>
}

type PurgeParams = {
  olderThan: number
}

type HubStoreEvents = {
  purge: { sequenceIDs: Array<string> }
}

type HubStore = {
  events: EventEmitter<HubStoreEvents>
  store(params: StoreParams): Promise<string>
  fetch(params: FetchParams): Promise<FetchResult>
  ack(params: AckParams): Promise<void>
  purge(params: PurgeParams): Promise<Array<string>>
}
```

### Semantics

- **`store`:** Persists the payload once. Creates a delivery record for each recipient. Returns the assigned sequence ID. For group messages (`hub/group/send`), the hub server resolves the group roster before calling store — the store has no concept of groups.
- **`fetch`:** Returns messages for a recipient, ordered by sequence ID. `after` is a cursor — returns messages after that sequence ID. `limit` controls batch size. `ack` allows acknowledging a previous batch in the same call (optimization to avoid a separate round-trip). `cursor` in the result is the sequence ID of the last message in the batch (null if no messages). `hasMore` is set by the backend when it can cheaply determine more messages exist (e.g. fetched limit+1 rows); omitted when unknown.
- **`ack`:** Marks delivery records as complete for the given recipient + sequence IDs. When all recipients for a stored message have acked, the message payload is deletable (reference counting).
- **`ack` in `fetch`:** Convenience for the common flow: ack previous batch, get next batch, single call.

### Reference counting

A message stored with N recipients has N delivery records. Each `ack` decrements the count for that recipient. When all N have acked, the underlying payload can be garbage collected. The in-memory implementation deletes immediately; durable backends may defer cleanup.

### Message eviction

Messages that remain unacked can be evicted two ways:

- **Consumer-driven:** Call `purge({ olderThan })` to explicitly remove messages older than the given age (in seconds). Returns the sequence IDs of purged messages. Useful for tests and scheduled cleanup.
- **Store-driven:** The backend may evict messages on its own (e.g. LRU cache, TTL policy). When it does, it emits a `purge` event via the `events` emitter (`EventEmitter<HubStoreEvents>` from `@enkaku/event`) with the affected sequence IDs. The hub server can listen to this event to clean up related in-memory state.

Both paths emit the same `purge` event so the hub server has a single integration point.

---

## 3. Revocation Primitive

### Rationale

The capability system (`@enkaku/capability`) supports delegation chains with a `verifyToken` hook for custom checks. For service delegation and cross-user delegation, third parties need to verify that a capability hasn't been revoked. Today there's no standard revocation mechanism — only the hook point.

Expiration is the primary revocation strategy: short-lived tokens expire naturally. The revocation primitive is for long-lived delegations that need to be cut before expiry.

### Components

**`RevocationRecord`:** A signed token asserting that a specific capability (identified by `jti`) has been revoked. Signed by the issuer of the original capability.

```
RevocationRecord:
  jti: string         -- ID of the revoked capability
  iss: string         -- DID of the revoker (must be issuer of the original capability)
  rev: true           -- marks this as a revocation
  iat: number         -- when the revocation was issued
```

**`RevocationBackend`:** Storage interface for revocation records.

```typescript
type RevocationBackend = {
  add(record: RevocationRecord): Promise<void>
  isRevoked(jti: string): Promise<boolean>
}
```

Enkaku provides an in-memory implementation for testing. Durable backends (database, distributed registry, hub endpoint) are consumer-provided.

**`createRevocationChecker`:** Factory that returns a `VerifyTokenHook` backed by a `RevocationBackend`. Plugs directly into `DelegationChainOptions.verifyToken`.

```typescript
function createRevocationChecker(backend: RevocationBackend): VerifyTokenHook
```

Usage:

```typescript
const checker = createRevocationChecker(backend)
await checkDelegationChain(payload, chain, { verifyToken: checker })
```

### Distribution

How revocation lists are distributed is out of Enkaku's scope. Possible strategies (all consumer-level):
- Hub exposes a revocation endpoint
- HTTP-based CRL
- Gossip between peers
- Bundled with capability presentation

---

## 4. Root Identity Adoption

### Rationale

When a user connects a Ledger to adopt their existing device identity, no new Enkaku primitives are needed. The existing `createCapability` function handles it: the Ledger (as `SigningIdentity`) signs a capability where `sub` = Ledger DID, `aud` = device DID.

### Pattern

```typescript
// Ledger adopts existing device
const delegation = await createCapability(ledgerIdentity, {
  sub: ledgerIdentity.id,    // root is the subject
  aud: deviceDID,            // device is the audience (delegate)
  act: '*',                  // or scoped permissions
  res: '*',                  // or scoped resources
  exp: optionalExpiration,
})
```

After adoption:
- The device stores the delegation token
- When acting on behalf of the root, the device presents its own token + the delegation chain
- The device DID doesn't change — it just gains a verifiable chain to the root
- Existing group memberships and server associations don't need to change unless the application layer decides to re-announce

### Transition semantics

Before adoption, the device's tokens have `iss === sub` (self-sovereign). After adoption, the device can present tokens with `sub` = root DID and a delegation chain. The application layer (Kubun) decides when and where to use which identity mode. Enkaku provides both paths; the switch is a consumer concern.

---

## What Enkaku Does NOT Own

These are explicitly out of scope for this work:

- **Data archival and recovery** — Kubun concern. Enkaku provides JWE encryption to a root identity's public key (already exists) as the primitive.
- **State synchronization between devices** — Higher-level protocol on top of the mailbox channel.
- **Known-devices list management** — Application-level local state.
- **MLS epoch key backup** — Kubun concern. Each device is a separate MLS group member; key material management is above Enkaku's layer.
- **Group membership UX** — Application-level orchestration of `hub/group/join`, MLS invites, capability delegation.
- **Revocation distribution** — Enkaku defines the record format and checker interface; distribution is consumer-provided.
- **Multi-recipient JWE** — Not needed for this work. Single-recipient JWE already covers the delegation and mailbox use cases.

---

## Integration Tests

New test file: `tests/integration/hub-agent-scenarios.test.ts`

Tests cover the multi-device interaction scenarios discussed in this spec, using in-memory transport and in-memory `HubStore`.

### Scenario A: Multi-device via hub

- **Two devices, blind relay:** Device A sends an opaque payload via `hub/send` to Device B's DID. Device B receives it via `hub/receive` channel, acks. Verify hub never sees plaintext.
- **Store-and-forward:** Device B is offline. Device A sends a message. Device B connects later, opens `hub/receive`, gets the queued message, acks.
- **Pagination:** Multiple messages queued for a device. Device opens `hub/receive` with a limit, gets a batch, acks, fetches next batch via cursor. Verify ordering and `hasMore`.
- **Ack semantics:** Messages are not purged until acked. Device fetches messages, does NOT ack, reconnects — messages are re-delivered.
- **Combined ack+fetch:** Device acks previous batch in the same `fetch` call that requests the next batch. Verify acked messages are not re-delivered.

### Scenario A: Group communication

- **Group fan-out:** Two devices join a group via `hub/group/join`. Device A sends via `hub/group/send`. Device B receives the message. Device A does not receive its own message.
- **Group send fails on unknown group:** Sending via `hub/group/send` to a group with no members returns an error.
- **Group receive filter:** Device is a member of groups X and Y. Opens `hub/receive` with `groupIDs: ['X']`. Only receives messages from group X. Direct messages (via `hub/send`) are still delivered.
- **Mixed delivery:** Device receives both group messages (with `groupID` set) and direct messages (no `groupID`) on the same `hub/receive` channel.

### Scenario B: Delegation chain verification

Tests use `@enkaku/hd-keystore` as a proxy for root identity (same `FullIdentity` interface as Ledger, no hardware needed).

- **Root delegates to device:** HD keystore root creates a capability for a device DID. Third party verifies the chain.
- **Scoped delegation to service:** Root creates a time-limited, scoped capability for a service DID. Service presents chain to a verifier. Verify permission checking (allowed action passes, disallowed action fails).
- **Expired delegation rejected:** Delegation token with past `exp` is rejected during chain verification.
- **Revocation:** Root revokes a capability by `jti`. `createRevocationChecker` plugged into `verifyToken` rejects the revoked token during chain verification.

### Store eviction

- **Consumer-driven purge:** Store messages, call `purge({ olderThan })`, verify returned sequence IDs and that purged messages are no longer fetchable.
- **Store-driven eviction event:** Configure in-memory store with a size limit. Store enough messages to trigger eviction. Verify `purge` event is emitted with correct sequence IDs.
- **Reference counting:** Message sent to 2 recipients. One acks. Message is not purged. Second acks. Message is purgeable.

---

## Packages Affected

| Package | Changes |
|---|---|
| `@enkaku/hub-protocol` | Change `hub/receive` from stream to channel with ack + `groupIDs` filter. Split send into `hub/send` (explicit recipients) and `hub/group/send` (group routing). Simplify message shape to opaque payload. |
| `@enkaku/hub-server` | Implement mailbox channel handler. Two send handlers. Update `HubStore` interface with `purge` + `events`. New in-memory store with reference counting and eviction. `hub/group/send` fails on unknown group. |
| `@enkaku/hub-client` | Update `receive()` to channel API. Separate `send()` and `groupSend()` methods. Add ack support. |
| `@enkaku/capability` | Add `RevocationRecord` type, `RevocationBackend` interface, `createRevocationChecker` factory, in-memory backend. |

No new packages.
