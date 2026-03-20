# MLS, Groups & Hub: E2EE and Group Communication for the Yulsi Stack

**Date:** 2026-03-20
**Status:** Draft
**Scope:** Enkaku packages only (Kubun integration is a separate design)

## Problem

Sakui (and future Yulsi applications) needs:

1. **Multi-device sync** — a single user's desktop, mobile, and web clients sharing data with E2E encryption
2. **Multi-user groups** — contacts, families, teams sharing selective subsets of data
3. **Zero-knowledge relay** — intermediary servers that route encrypted messages without accessing content

These capabilities don't exist in the Yulsi stack today. Kubun provides document sync between trusted servers, but it requires the server to have full knowledge of document metadata. An E2EE layer is needed where the relay server sees only routing metadata.

## Solution Overview

Extend Enkaku with three concerns, implemented as four new packages:

1. **Group Identity** (`@enkaku/group`) — group lifecycle management using `ts-mls` for MLS protocol operations and Enkaku capabilities as membership credentials
2. **Hub** (`@enkaku/hub-protocol`, `@enkaku/hub-client`, `@enkaku/hub-server`) — group-aware message routing using standard Enkaku server with additional client state management

### Why ts-mls Instead of a Custom MLS Implementation

RFC 9420 is 132 pages. A correct implementation requires 10,000-20,000+ lines of security-critical cryptographic code covering TreeKEM, key schedule, HPKE, binary codec, and message framing. `ts-mls` (v1.6.2, actively maintained, MIT licensed) provides:

- Pure TypeScript, immutable API, RFC 9420 conformance
- Single hard dependency (`@hpke/core`), optional `@noble/*` crypto provider
- Already used by downstream projects (marmot-ts)
- Post-quantum support (ML-KEM, ML-DSA, X-Wing) for future use

**Runtime compatibility:**
- **Node.js 24+:** Works out of the box
- **Modern browsers:** Works out of the box (uses Web Crypto SubtleCrypto)
- **Hermes (React Native):** Requires a pure-`@noble/*` `CryptoProvider` — the default provider and `nobleCryptoProvider` both delegate KDF/HPKE operations to `@hpke/core` which calls `crypto.subtle`, unavailable in Hermes. The fix is a bounded piece of work: implement a `CryptoProvider` using `@noble/hashes` (HKDF), `@noble/curves` (ECDH/Ed25519), and `@noble/ciphers` (AES-GCM) — libraries already proven in Hermes via `@enkaku/expo-keystore`. Only `getRandomValues` (solved via `expo-crypto`) and `TextDecoder` (small polyfill) are additionally needed. This can be contributed upstream or maintained as `@enkaku/mls-crypto-noble`.

### Why Enkaku, Not a Standalone Repo

Enkaku already holds the identity (DIDs), cryptography (Ed25519, X25519, AES-GCM), capability delegation, and server/client/transport abstractions. The new packages extend these naturally:

- `group` extends the identity/capability layer and wraps `ts-mls`
- `hub-*` extends the server/client/protocol layer

A standalone repo would duplicate transport and identity concerns, and create a parallel messaging system alongside Kubun sync. Instead, Kubun document sync runs *inside* the encrypted tunnel that Enkaku provides — one sync system, now with E2E encryption.

### Relationship to Kubun

Kubun's role is unchanged: document storage, CRDT merge, Merkle sync. The key difference:

- **Current:** Kubun syncs between trusted servers that see document metadata
- **With this design:** Kubun Merkle sync runs peer-to-peer between group members, tunneled through the Enkaku hub as encrypted bytes. The hub sees only routing metadata.

A `GroupSyncScope` interface (defined in `@enkaku/group`) describes what data a group shares. Kubun consumes this to know what to sync. The detailed Kubun-side design is a separate spec.

The hub needs persistent storage for store-and-forward. It defines a `HubStore` interface. Kubun can implement this (e.g., `@kubun/hub-store`), but any storage backend works. This is out of scope for this spec.

## Architecture

### Package Dependency Graph

```
hub-client          hub-server
    ↓                   ↓
hub-protocol         group
    ↓                   ↓
                      ts-mls
                        ↓
              @hpke/core · @noble/*

Additional dependencies:
  group        → @enkaku/token, @enkaku/capability, ts-mls
  hub-protocol → @enkaku/protocol
  hub-client   → @enkaku/client, hub-protocol
  hub-server   → @enkaku/server, hub-protocol, group
```

### Two-Layer Sync Model

Communication uses two layers:

**Outer layer (E2EE relay):** Routes encrypted blobs between group members via the hub. The hub sees only: sender DID, group ID, epoch number, content type (commit/proposal/welcome/application), and the encrypted payload. It cannot see document models, field values, mutation operations, or any application semantics.

**Inner layer (Kubun document sync):** Full Merkle sync between group members who share the MLS group keys. Runs inside the encrypted tunnel. All the rich Kubun semantics (models, CRDT merge, HLC ordering, access control) operate at this layer.

### Two Sync Modes

**Store-and-forward (offline):** Each mutation is individually encrypted with MLS group keys and sent to the hub. The hub stores it in the recipient's inbox. When the recipient connects, queued messages are delivered. Always works, no coordination needed.

**Live tunnel (online):** When two group members are both connected to the hub, they can establish a bidirectional tunnel. Kubun Merkle sync runs through this tunnel for bandwidth-efficient bulk catch-up. The hub proxies bytes without inspecting them.

## Package Specifications

### 1. `@enkaku/group` — Group Identity & Membership

Bridges ts-mls protocol operations with Enkaku's identity system. Depends on `ts-mls`, `@enkaku/token`, `@enkaku/capability`.

#### Credential Model

MLS credentials are Enkaku capability tokens. A member's credential is their DID + a capability delegation chain proving membership.

```
MemberCredential {
  did: string                          — member's DID (did:key:z...)
  capabilityChain: Array<SignedToken>  — delegation chain proving membership
  signatureKey: Uint8Array             — Ed25519 public key (from DID)
  leafNode: LeafNode                   — MLS leaf node
}
```

The root capability for a group:
```
{
  iss: creatorDID,
  sub: creatorDID,
  act: ['admin'],
  res: ['group/<groupID>/*']
}
```

Delegated membership:
```
{
  iss: inviterDID,
  sub: inviteeDID,
  aud: inviterDID,
  act: ['member'],          — or 'admin', 'read'
  res: ['group/<groupID>/*'],
  exp: <optional expiration>
}
```

Permission levels:
- `admin` — can invite/remove members, commit group changes
- `member` — can send and receive encrypted messages
- `read` — can receive but not send

#### Dual Validation Model

Message processing validates both the MLS signature AND the capability chain:

- **MLS validation** (client-side): Verifies the MLS message signature against the sender's leaf node in the ratchet tree. The hub cannot do this — it sees only opaque encrypted bytes.
- **Capability validation** (client-side + hub-side): The hub validates capability credentials when a client calls `hub/group/join` — it verifies the delegation chain before accepting the membership claim. Group members also validate credentials embedded in MLS key packages when processing Welcome messages.

**Capability expiration during an epoch:** If a member's capability expires, their messages are rejected by other members at the application layer even though the MLS signature is still valid. The admin should issue a Remove proposal to eject them from the MLS group state, advancing the epoch and rotating keys. Until the Remove is committed, the expired member technically still has epoch keys but other members refuse to process their messages.

**Revocation enforcement:** Capability revocation is immediate at the hub (the hub stops routing messages for the revoked member) and deferred at the MLS layer (requires a Remove + Commit to rotate keys). This two-phase approach is acceptable because:
1. The hub blocks message delivery immediately (fast path)
2. Key rotation happens on the next Commit (eventual consistency)
3. Between revocation and key rotation, the revoked member could theoretically decrypt messages if they had a direct channel — but the hub won't deliver them

#### Core Types

- **`GroupHandle`** — mutable wrapper around the current ts-mls `GroupState` + the holder's `MemberCredential`. Tracks the latest epoch and provides methods for group operations.
- **`Invite`** — contains the delegated membership capability token for the invitee. Does not contain MLS state — the inviter holds that.
- **`KeyPackageRequest`** — describes what key package is needed to complete an invite (target DID, required ciphersuite). Used to fetch from hub or accept via direct exchange.

#### Group Lifecycle

```
createGroup(identity, options) → { group: GroupHandle, credential: MemberCredential }
createInvite(group, recipientDID, permissions) → { invite: Invite, keyPackageRequest: KeyPackageRequest }
commitInvite(group, invite, keyPackage) → { commitMessage, welcomeMessage, newGroup }
processWelcome(identity, invite, welcome) → { group: GroupHandle, credential: MemberCredential }
removeMember(group, memberDID) → { commitMessage, newGroup }
updateKeys(group, identity) → { commitMessage, newGroup }
```

Note: `commitInvite` is called by the inviter (who holds the group state and produces the MLS Commit + Welcome). `processWelcome` is called by the invitee (who receives the Welcome and joins the group).

#### Concurrent Commits

MLS allows only one valid Commit per epoch. When two admins commit simultaneously:

1. The first Commit received by other members advances the epoch. The second Commit references a stale epoch and is rejected.
2. The admin whose Commit was rejected must re-fetch the current group state (from the new epoch), re-create their proposals against the new state, and commit again.
3. The hub does not arbitrate — it delivers Commits in arrival order. Conflict resolution is handled by clients applying MLS rules (one Commit per epoch).

For small groups (<20 members), conflicts are rare. For larger groups, a "designated committer" pattern can be used where only one admin commits at a time.

#### Epoch Management

Proposals can be batched or committed immediately. Trade-offs:

- **Immediate commit (default for small groups):** Each Add/Remove/Update is committed as it happens. Simpler, lower latency, more key rotations.
- **Batched commit:** Collect proposals, commit periodically or on threshold. Fewer key rotations, but higher latency for membership changes.

The `GroupHandle` supports both patterns. The application chooses when to call `commit()`.

#### Key Package Lifecycle

- **Pre-generation:** Clients should upload multiple key packages (recommended: 10) to the hub. Each key package is single-use — consumed when someone adds the client to a group.
- **Replenishment:** When a client connects and its key package count on the hub is below a threshold (e.g., 5), it generates and uploads more.
- **Expiration:** Key packages include an optional expiration. The hub should discard expired packages.
- **Rotation:** Key packages contain HPKE init keys. Uploading new packages doesn't invalidate old ones — each is independently usable.

#### Device Groups vs User Groups

Both use the same primitives:

- **Device group:** All members share the same user DID with different device keys. Root capability is self-issued. Adding a phone is the same operation as inviting a friend — just with a self-issued capability.
- **User group:** Members have different DIDs. Root capability issued by group creator.

The package does not enforce this distinction; it falls out from how capabilities are issued.

#### Group Size

Target: up to ~100 members. TreeKEM operations are O(log n), so a 100-member group has tree depth ~7. This covers:
- Device groups (typically 2-5 devices)
- Family/friend groups (2-20 people)
- Team groups (5-50 people)
- Community groups (up to ~100)

Groups beyond 100 are not a target for the initial implementation. The MLS protocol supports larger groups but the UX and performance trade-offs change significantly.

#### Key Package Management

```
createKeyPackage(identity, credential, ciphersuite) → KeyPackage
validateKeyPackage(keyPackage) → validates signature + credential + capability chain
```

Key packages include the capability chain so recipients of a Welcome can verify the new member was legitimately invited.

Key packages are hosted on the hub (primary) or exchanged directly (QR codes, links). Broader discovery mechanisms are out of scope.

#### Missed Epoch Recovery

If a client misses one or more epochs (e.g., was offline during key rotations):

1. **Small gap (missed a few Commits):** The hub delivers queued Commits in order. The client processes them sequentially, advancing through each epoch.
2. **Large gap or corrupted state:** The client cannot recover incrementally. An admin must re-invite the client: issue a Remove (to clean up the stale leaf), then a new Add with a fresh key package + Welcome. The client re-joins with current group state.

The hub's store-and-forward queue is the primary mechanism for gap recovery. Queue retention policy is configurable on the hub.

#### Group Sync Scope Interface

Defines what data a group shares, consumed by Kubun's sync layer:

```
GroupSyncScope {
  groupID: string
  models: Array<{ modelID: string, filter?: DocumentFilter }>
}
```

This interface is the boundary between Enkaku (who can access) and Kubun (what is shared). The detailed Kubun-side design is a separate spec.

### 2. `@enkaku/hub-protocol` — Hub Protocol Types

Defines the `HubProtocol` as a distinct Enkaku protocol (same pattern as `RuntimeProtocol` in Sakui, or Kubun's graph protocol). Depends on `@enkaku/protocol`.

#### Protocol Messages

```
hub/send              — request: client sends encrypted message to a group
hub/receive           — stream: server pushes messages to a connected client
hub/tunnel/request    — channel: bidirectional tunnel between two peers
hub/keypackage/upload — request: client uploads key packages
hub/keypackage/fetch  — request: client fetches key packages for a DID
hub/group/join        — request: client announces group membership (with credential)
hub/group/leave       — request: client leaves a group on this hub
```

All messages are standard Enkaku procedure types — the hub is implemented as a standard `serve()` with `HubProtocol`.

#### Routed Message

What the hub sees for each message:

```
RoutedMessage {
  senderDID: string
  groupID: string
  epoch: number
  contentType: 'commit' | 'proposal' | 'welcome' | 'application'
  payload: Uint8Array   — encrypted, opaque to hub
}
```

#### HubStore Interface

Defines the storage contract for hub persistence. Implementations are external.

```
HubStore {
  enqueue(recipientDID, message: RoutedMessage): Promise<void>
  dequeue(recipientDID, limit?): Promise<Array<RoutedMessage>>
  storeKeyPackage(ownerDID, keyPackage: Uint8Array): Promise<void>
  fetchKeyPackages(ownerDID, count?): Promise<Array<Uint8Array>>
  setGroupMembers(groupID, members: Array<string>): Promise<void>
  getGroupMembers(groupID): Promise<Array<string>>
}
```

### 3. `@enkaku/hub-client` — Client

Client-side utilities for connecting to a hub. Depends on `@enkaku/hub-protocol`, `@enkaku/client`.

Provides type-safe interaction with the hub:

```ts
import { Client } from '@enkaku/client'
import type { HubProtocol } from '@enkaku/hub-protocol'

const client = new Client<HubProtocol>({ transport, identity })

// Send encrypted message to group
await client.request('hub/send', { param: { groupID, message } })

// Receive messages (server-pushed stream)
const stream = client.createStream('hub/receive', { param: { groups } })
for await (const msg of stream.readable) { ... }

// Establish live tunnel for Kubun Merkle sync
const tunnel = client.createChannel('hub/tunnel/request', { param: { peerDID, groupID } })

// Key package management
await client.request('hub/keypackage/upload', { param: { keyPackages } })
const packages = await client.request('hub/keypackage/fetch', { param: { did: bobDID } })
```

The `hub-client` package adds convenience wrappers on top of the raw `Client<HubProtocol>`:
- Automatic key package replenishment on connect
- Group membership announcement on connect (`hub/group/join` for all active groups)
- Reconnection handling (re-announce groups, drain queued messages)
- Tunnel lifecycle management (request, use, close)

### 4. `@enkaku/hub-server` — Server

Group-aware message routing server using standard Enkaku `serve()` with `HubProtocol`. Depends on `@enkaku/hub-protocol`, `@enkaku/server`, `@enkaku/group`.

#### Client State Management

The hub server maintains additional state beyond what a basic Enkaku server tracks:

```
HubClientState {
  did: string                          — authenticated client DID
  groups: Set<string>                  — groups this client has joined on this hub
  receiveStream: WritableStream | null — the client's hub/receive stream (if connected)
}
```

A `HubClientRegistry` manages connected client state:
- Tracks which clients are online and which groups they belong to
- Routes messages: `hub/send` handler looks up group members in the registry, writes to each member's `receiveStream`
- For offline members (or when no `HubStore`): drop the message (fire-and-forget) or enqueue (store-and-forward)
- Tunnel brokering: when a client requests a tunnel, the registry checks if the target peer is online and connected

This registry is the "additional logic" the hub needs beyond a standard Enkaku server. It lives in the handler implementations, not in a new server framework.

#### Three Operating Modes

**Fan-out (always on):** Client sends encrypted message for a group → `hub/send` handler looks up group members in the registry → writes to each connected member's `hub/receive` stream.

**Store-and-forward (opt-in, requires `HubStore`):** When a recipient is offline, the `hub/send` handler calls `store.enqueue()`. When a client connects and opens `hub/receive`, the handler calls `store.dequeue()` and delivers queued messages before switching to live fan-out.

**Tunnel proxy (on-demand):** Client A requests a tunnel to Client B via `hub/tunnel/request` (a channel procedure). The handler checks if B is connected, and if so, opens a reciprocal channel to B. The hub pipes bytes between the two channels without inspection.

#### Authentication

Clients authenticate on connection using Enkaku's existing signed token mechanism. The hub verifies the DID signature. Group membership claims are verified when the client calls `hub/group/join` — the handler validates the capability delegation chain before adding the client to the group in the registry.

#### What the Hub Does NOT Do

- Decrypt any message content
- Know what models or documents are being synced
- Enforce application-level access control
- Persist message content long-term (store-and-forward is a queue, not an archive)

## End-to-End Flows

### Flow 1: Add a Device

User has a desktop and wants to add their mobile.

1. Mobile generates device keys, creates key packages (`group.createKeyPackage()`)
2. Desktop scans QR code containing: mobile DID + hub URL + key package
3. Desktop creates a self-issued invite (`group.createInvite()`) — same user, new device
4. Desktop commits the invite with mobile's key package (`group.commitInvite()`) — produces MLS Commit + Welcome
5. Desktop sends Welcome via hub (`hubClient.request('hub/send', ...)`)
6. Mobile receives Welcome from hub (via `hub/receive` stream)
7. Mobile processes Welcome (`group.processWelcome()`) — gets GroupHandle with current epoch keys
8. Mobile is now a group member, can send/receive encrypted messages

### Flow 2: Create a Group and Share Data

Alice wants to share tasks with Bob.

**Setup:**
1. Alice creates a group (`group.createGroup()`) — gets GroupHandle + root capability
2. Alice creates an invite for Bob (`group.createInvite(group, bobDID, 'member')`)
3. Alice fetches Bob's key package from the hub (`hubClient.request('hub/keypackage/fetch', ...)`)
4. Alice commits the invite with Bob's key package (`group.commitInvite()`) — produces Commit + Welcome
5. Welcome sent via hub to Bob
6. Bob processes Welcome — now has group keys

**Data sharing (store-and-forward):**
1. Alice creates a Task (Kubun mutation)
2. Alice encrypts the mutation via GroupHandle (which calls `ts-mls` encrypt internally)
3. Alice sends via hub (`hubClient.request('hub/send', { param: { groupID, message } })`)
4. Hub fans out to Bob (or queues if offline)
5. Bob receives and decrypts via GroupHandle — recovers the Kubun mutation
6. Bob applies mutation to local Kubun DB — task appears in UI

**Live sync (both online):**
1. Alice and Bob are both connected to the hub
2. One requests a tunnel (`hubClient.createChannel('hub/tunnel/request', { param: { peerDID } })`)
3. Hub establishes bidirectional proxy
4. Kubun Merkle sync runs inside the tunnel — efficient bulk catch-up
5. Hub passes bytes, cannot read content

### Flow 3: Remove a Member

1. Admin calls `group.removeMember(group, memberDID)`
2. MLS Remove proposal + Commit produced — advances epoch, rotates keys
3. Commit sent via hub to remaining members
4. Remaining members process Commit — they have new epoch keys
5. Removed member's old keys cannot decrypt messages from the new epoch
6. Admin revokes capability (expiration or explicit) — hub stops routing for revoked member

## Delivery Phases

### Phase 1: Group Identity (`@enkaku/group`)

`@enkaku/group` + `ts-mls` dependency. Independently useful for any Enkaku app that wants E2EE between known peers (direct WebSocket, no hub needed).

Deliverables:
- GroupHandle, MemberCredential, Invite, KeyPackageRequest types
- Group lifecycle: create, invite, commit invite, process welcome, remove, update keys
- Capability-based credential model
- Key package creation and validation
- Device group and user group patterns
- Hermes-compatible `CryptoProvider` (pure `@noble/*`)

### Phase 2: Hub Protocol (`@enkaku/hub-protocol`)

Protocol type definitions. Enables parallel client/server development.

Deliverables:
- HubProtocol type definition with all procedure types
- RoutedMessage type
- HubStore interface
- JSON Schema for all hub messages

### Phase 3: Hub Server & Client (`@enkaku/hub-server`, `@enkaku/hub-client`)

Full routing server with store-and-forward and client convenience wrappers.

Deliverables:
- HubClientRegistry for connected client state
- Fan-out routing in hub/send handler
- Store-and-forward with HubStore
- Tunnel proxy via hub/tunnel/request channel
- Client auto-reconnection and queue draining
- Key package lifecycle management
- Integration tests with DirectTransports

### Phase 4: Kubun Integration (separate spec)

End-to-end encrypted document sync. Out of scope for this spec.

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MLS implementation | `ts-mls` library | RFC 9420 is 132 pages of security-critical code. ts-mls is actively maintained, pure TypeScript, immutable API. Build custom `CryptoProvider` for Hermes rather than reimplement all of MLS. |
| Hermes support | Custom `CryptoProvider` using `@noble/*` | ts-mls's default and noble providers both depend on `@hpke/core` which needs `crypto.subtle`. A pure-noble provider bypasses this. Bounded work, contributable upstream. |
| Hub server type | Standard `serve()` with HubProtocol | Hub protocol messages map directly to Enkaku's four procedure types. Fan-out/routing logic is handler-level state (HubClientRegistry), not a new framework concern. |
| Identity/credentials | Enkaku capabilities | DID + delegation chain. Reuses existing infrastructure, provides scoped/revocable membership. |
| Wire format | Hybrid | Binary for crypto core (ts-mls handles this). JSON for transport envelope (Enkaku convention). |
| Sync model | Hybrid | Store-and-forward (offline, always works) + live Merkle tunnel (online, bandwidth-efficient). |
| Hub protocol | Distinct `HubProtocol` | Consistent with Enkaku pattern: each concern defines its own protocol type. |
| Package split | hub-protocol / hub-client / hub-server | Follows Enkaku and Kubun convention. Clean dependency graph. |
| Relay naming | "hub" | Avoids collision with GraphQL Relay used in Kubun. |
| Kubun relationship | Interface boundary only | `GroupSyncScope` defines what to sync. Kubun-side design is a separate spec. |
| Key package discovery | Hub-hosted + direct import | Broader discovery mechanism out of scope. |
| Service discovery / federation | Out of scope | Focus on single-hub scenarios first. |
| Group size target | Up to ~100 members | Covers device groups, families, teams. TreeKEM O(log n) keeps operations fast at this scale. |
| Dual validation | Capability (hub + client) + MLS (client only) | Hub validates credentials at join time. Clients validate both MLS signatures and capability chains. Two-phase revocation: immediate hub block + deferred key rotation. |

## Out of Scope

- **Service discovery / federation** — how clients find hub URLs, how hubs talk to each other
- **Kubun sync integration details** — how Kubun's sync negotiation changes, how documents are tagged with group IDs, local DB organization
- **Exotic MLS features** — ReInit, ExternalInit, PSK, external joins, GroupContextExtensions
- **Transport middleware improvements** — cleaner interceptor API for the basic Enkaku server (orthogonal concern)
- **`HubStore` implementations** — Kubun-backed or otherwise (the interface is defined, implementations are external)
- **Binary transport encoding** — may be added at higher levels over time, starts with JSON envelopes
- **Groups > 100 members** — different UX/performance trade-offs, not a target for initial implementation
