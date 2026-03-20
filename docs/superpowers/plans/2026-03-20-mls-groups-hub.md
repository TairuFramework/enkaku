# MLS, Groups & Hub — Implementation Plan

**Date:** 2026-03-20
**Spec:** `docs/superpowers/specs/2026-03-20-mls-groups-hub-design.md`
**Stage:** reviewing

## Overview

Implement E2EE group communication for the Yulsi stack as four new Enkaku packages, phased for incremental delivery. Uses `ts-mls` for MLS protocol operations, standard Enkaku `serve()` for the hub server.

## Phase 1: `@enkaku/group` — Group Identity & Membership

### 1.1 — ts-mls integration spike

Validate ts-mls API compatibility with Enkaku's identity model before committing to full implementation.

- [ ] Add `ts-mls` to pnpm catalog, create `packages/group/` with standard package scaffold (package.json, tsconfig.json, src/, test/)
- [ ] Write a spike test (`test/ts-mls-spike.test.ts`) that exercises the ts-mls API surface we need:
  - Create a group with two members using Ed25519 keys from `@enkaku/token`
  - Create key packages, commit an Add, produce + process a Welcome
  - Encrypt/decrypt an application message
  - Remove a member, verify old keys can't decrypt new messages
- [ ] Confirm ts-mls's `CryptoProvider` interface — document what methods need reimplementing for the noble provider
- [ ] Verify ts-mls key format compatibility with Enkaku's Ed25519 keys (32-byte seeds from `@noble/curves`)

### 1.2 — Hermes-compatible CryptoProvider

Pure `@noble/*` CryptoProvider for ts-mls, enabling React Native support.

- [ ] Create `src/crypto.ts` — implement `CryptoProvider` using:
  - `@noble/hashes/sha2` + `@noble/hashes/hmac` for SHA-256/384/512 and HMAC
  - `@noble/hashes/hkdf` for HKDF extract/expand (replaces `@hpke/core` KDF)
  - `@noble/curves/ed25519` for Ed25519 sign/verify and X25519 ECDH (replaces `@hpke/core` KEM)
  - `@noble/ciphers/aes` for AES-128-GCM and AES-256-GCM (replaces `@hpke/core` AEAD)
  - HPKE (RFC 9180) encrypt/decrypt built on top of the above primitives
- [ ] Write unit tests (`test/crypto.test.ts`) verifying correctness against ts-mls's default provider:
  - Same inputs → same outputs for every CryptoProvider method
  - HPKE encrypt with default provider, decrypt with noble provider (and vice versa)
  - Key schedule derivation produces identical epoch secrets
- [ ] Add e2e-expo test for CryptoProvider (see 1.6)

### 1.3 — Credential model

Bridge Enkaku capabilities with MLS credentials.

- [ ] Create `src/credential.ts` — `MemberCredential` type and factory functions:
  - `createMemberCredential(identity, capabilityChain)` — constructs credential from Enkaku identity + delegation chain
  - `validateMemberCredential(credential)` — verifies capability chain using `@enkaku/capability`, checks expiration
  - `credentialToMLSCredential(credential)` — converts to ts-mls credential format
  - `mlsCredentialToMemberCredential(mlsCredential)` — extracts Enkaku credential from MLS credential
- [ ] Create `src/capability.ts` — group capability helpers:
  - `createGroupCapability(identity, groupID)` — creates root admin capability (`iss === sub`)
  - `delegateGroupMembership(identity, groupID, recipientDID, permissions, options?)` — creates delegated capability with permission level and optional expiration
  - `validateGroupCapability(token, groupID)` — validates a capability is for the specified group with valid delegation chain
- [ ] Unit tests (`test/credential.test.ts`, `test/capability.test.ts`):
  - Round-trip: create credential → convert to MLS → convert back → validate
  - Permission hierarchy: admin > member > read
  - Delegation chain: root → admin → member, root → admin → admin → member
  - Expiration: reject expired credentials
  - Invalid chains: wrong group ID, broken delegation, exceeds max depth

### 1.4 — GroupHandle and lifecycle

Core group operations wrapping ts-mls.

- [ ] Create `src/group.ts` — `GroupHandle` class:
  - Constructor takes ts-mls `GroupState` + `MemberCredential`
  - `#state` (private, mutable) — current ts-mls GroupState
  - `#credential` (private) — holder's MemberCredential
  - `get groupID()`, `get epoch()`, `get members()` — read-only accessors
  - `encrypt(plaintext: Uint8Array)` — encrypts application message with current epoch keys
  - `decrypt(message: Uint8Array)` — decrypts application message, validates sender credential
  - `processMessage(message: Uint8Array)` — processes Commit/Proposal, advances state
- [ ] Create `src/lifecycle.ts` — group lifecycle functions:
  - `createGroup(identity, options)` → `{ group: GroupHandle, credential: MemberCredential }`
  - `createInvite(group, recipientDID, permissions)` → `{ invite: Invite, keyPackageRequest: KeyPackageRequest }`
  - `commitInvite(group, invite, keyPackage)` → `{ commitMessage, welcomeMessage, newGroup }`
  - `processWelcome(identity, invite, welcome)` → `{ group: GroupHandle, credential: MemberCredential }`
  - `removeMember(group, memberDID)` → `{ commitMessage, newGroup }`
  - `updateKeys(group, identity)` → `{ commitMessage, newGroup }`
- [ ] Create `src/invite.ts` — `Invite` and `KeyPackageRequest` types
- [ ] Create `src/keyPackage.ts` — key package creation and validation:
  - `createKeyPackage(identity, credential, ciphersuite?)` — wraps ts-mls key package creation, embeds capability chain
  - `validateKeyPackage(keyPackage)` — validates MLS signature + Enkaku credential + capability chain
- [ ] Create `src/types.ts` — shared types (`GroupHandleParams`, `GroupOptions`, `GroupSyncScope`, etc.)
- [ ] Create `src/index.ts` — barrel exports

### 1.5 — Group package unit tests

- [ ] `test/group.test.ts` — GroupHandle lifecycle:
  - Create group → single member, epoch 0
  - Invite + commit → two members, epoch 1
  - Encrypt/decrypt round-trip between two members
  - Remove member → epoch 2, old member can't decrypt
  - Update keys → epoch advances, all members get new keys
  - Process stale-epoch commit → rejection
- [ ] `test/lifecycle.test.ts` — full lifecycle flows:
  - Flow 1: Add a device (self-issued invite, same user DID)
  - Flow 2: Create group, invite user, share data
  - Flow 3: Remove member, verify forward secrecy
  - Concurrent commit: two admins commit simultaneously, one rejected, re-create against new state
- [ ] `test/keyPackage.test.ts`:
  - Create and validate key package
  - Reject key package with invalid signature
  - Reject key package with expired credential
  - Reject key package with wrong group ID in capability

### 1.6 — React Native e2e test

Validate the noble CryptoProvider works on Hermes.

- [ ] Update `tests/e2e-expo/package.json` — add `@enkaku/group` and `ts-mls` dependencies
- [ ] Add polyfill for `TextDecoder` if needed (check if already available in current Hermes/RN version)
- [ ] Update `tests/e2e-expo/App.tsx` — add a "Group E2EE" test button that:
  1. Creates a group with the noble CryptoProvider
  2. Creates a second identity (in-memory, no keystore)
  3. Invites the second identity, commits, processes Welcome
  4. Encrypts a message with member 1, decrypts with member 2
  5. Displays "Group E2EE: OK" on success
- [ ] Add Maestro test (`tests/e2e-expo/.maestro/group-e2ee.yaml`):
  ```yaml
  appId: dev.enkaku.e2e
  ---
  - launchApp
  - tapOn: "Group E2EE"
  - assertVisible: "Group E2EE: OK"
  ```
- [ ] Run on iOS simulator and Android emulator to confirm

## Phase 2: `@enkaku/hub-protocol` — Protocol Types

### 2.1 — Package scaffold and protocol definition

- [ ] Create `packages/hub-protocol/` with standard package scaffold
- [ ] Create `src/protocol.ts` — `HubProtocol` type definition:
  - `hub/send` — request: `{ param: { groupID: string, message: RoutedMessage }, result: void }`
  - `hub/receive` — stream: `{ param: { groups: Array<string> }, receive: RoutedMessage }`
  - `hub/tunnel/request` — channel: `{ param: { peerDID: string, groupID: string }, send: Uint8Array, receive: Uint8Array }`
  - `hub/keypackage/upload` — request: `{ param: { keyPackages: Array<Uint8Array> }, result: void }`
  - `hub/keypackage/fetch` — request: `{ param: { did: string, count?: number }, result: { keyPackages: Array<Uint8Array> } }`
  - `hub/group/join` — request: `{ param: { groupID: string, credential: MemberCredential }, result: void }`
  - `hub/group/leave` — request: `{ param: { groupID: string }, result: void }`
- [ ] Create `src/types.ts` — `RoutedMessage`, `HubStoreInterface`, `HubClientState` types
- [ ] Create `src/store.ts` — `HubStore` interface definition
- [ ] Create `src/index.ts` — barrel exports
- [ ] Type tests (`test/protocol.test.ts`) — verify protocol types produce correct client/server type inference

## Phase 3: `@enkaku/hub-server` & `@enkaku/hub-client`

### 3.1 — Hub server — client registry and handlers

- [ ] Create `packages/hub-server/` with standard package scaffold
- [ ] Create `src/registry.ts` — `HubClientRegistry`:
  - `register(did, receiveWriter)` — register a connected client
  - `unregister(did)` — remove a disconnected client
  - `getOnlineMembers(groupID)` — returns DIDs of connected group members
  - `getReceiveWriter(did)` — returns the client's receive stream writer (or null if offline)
  - `joinGroup(did, groupID, credential)` — validates credential, adds DID to group membership
  - `leaveGroup(did, groupID)` — removes DID from group membership
  - `isOnline(did)` — check if a client is connected
- [ ] Create `src/handlers.ts` — handler implementations for each `HubProtocol` procedure:
  - `hub/send` — validate sender is group member, fan out to online members via registry, enqueue for offline members (if HubStore provided)
  - `hub/receive` — register client's receive stream in registry, drain queued messages from HubStore (if provided), then keep stream open for live messages
  - `hub/tunnel/request` — check if peer is online, create reciprocal channel, pipe bytes between the two
  - `hub/keypackage/upload` — store key packages via HubStore
  - `hub/keypackage/fetch` — fetch key packages from HubStore
  - `hub/group/join` — validate credential via `@enkaku/group`, register in registry
  - `hub/group/leave` — remove from registry
- [ ] Create `src/hub.ts` — `createHub(options)` convenience function:
  - Takes `transport`, `identity`, `store?` (optional HubStore), `logger?`, `tracer?`
  - Returns standard `serve<HubProtocol>(...)` with handlers wired up
  - Registry is created internally, shared across handlers via closure
- [ ] Create `src/types.ts` — `HubOptions`, `CreateHubParams`
- [ ] Create `src/index.ts` — barrel exports

### 3.2 — Hub client — convenience wrappers

- [ ] Create `packages/hub-client/` with standard package scaffold
- [ ] Create `src/client.ts` — `HubClient` class wrapping `Client<HubProtocol>`:
  - Constructor takes `Client<HubProtocol>` + `GroupHandle[]` (active groups)
  - `connect()` — announces group membership for all active groups (`hub/group/join`), starts receive stream (`hub/receive`), drains queued messages
  - `send(groupID, message)` — encrypts via GroupHandle, sends via `hub/send`
  - `receive(callback)` — processes incoming messages from receive stream, decrypts via GroupHandle, calls callback
  - `requestTunnel(peerDID, groupID)` — opens `hub/tunnel/request` channel, returns readable/writable pair
  - `uploadKeyPackages(identity, credential, count?)` — generates and uploads key packages
  - `fetchKeyPackages(did, count?)` — fetches key packages for a DID
  - `disconnect()` — leaves all groups, closes streams
- [ ] Create `src/types.ts` — `HubClientParams`, `HubClientOptions`
- [ ] Create `src/index.ts` — barrel exports

### 3.3 — Hub server unit tests

- [ ] `test/registry.test.ts` — HubClientRegistry:
  - Register/unregister clients
  - Join/leave groups
  - Get online members for a group
  - Multiple clients in same group
  - Client disconnects — properly cleaned up
- [ ] `test/handlers.test.ts` — handler behavior using DirectTransports:
  - `hub/send` — message delivered to online group members
  - `hub/send` — message enqueued for offline members (with HubStore)
  - `hub/send` — message dropped for offline members (without HubStore)
  - `hub/send` — rejected for non-member sender
  - `hub/receive` — drains queued messages on connect, then receives live
  - `hub/tunnel/request` — bidirectional byte relay between two peers
  - `hub/tunnel/request` — rejected when peer is offline
  - `hub/keypackage/upload` + `hub/keypackage/fetch` — round-trip
  - `hub/group/join` — validates credential, rejects invalid
  - `hub/group/leave` — removes from group
- [ ] `test/hub.test.ts` — `createHub()` integration:
  - Full flow: two clients connect, join group, send/receive messages
  - Store-and-forward: client A sends while B offline, B connects and receives queued messages
  - Tunnel: two clients establish tunnel, exchange bytes bidirectionally

### 3.4 — Hub client unit tests

- [ ] `test/client.test.ts` — HubClient:
  - Connect announces groups and starts receive stream
  - Send encrypts and delivers
  - Receive decrypts incoming messages
  - Disconnect leaves groups and closes streams
  - Key package upload and fetch

### 3.5 — Integration tests

- [ ] `tests/integration/hub.test.ts` — end-to-end hub integration:
  - **Full group lifecycle:** Alice creates group → invites Bob → Bob processes Welcome → both connect to hub → Alice sends encrypted message → Bob receives and decrypts
  - **Store-and-forward:** Alice sends while Bob offline → Bob connects → receives queued message
  - **Live tunnel:** Alice and Bob connect → establish tunnel → exchange bytes → close tunnel
  - **Member removal:** Alice removes Bob → sends new message → Bob cannot decrypt
  - **Multi-device:** User adds second device → both devices receive messages
  - **Concurrent commits:** Two admins commit simultaneously → one rejected → re-creates proposals
  - Uses DirectTransports (no network), in-memory HubStore implementation for tests

### 3.6 — In-memory HubStore for testing

- [ ] Create `packages/hub-server/src/memoryStore.ts` — `createMemoryStore()`:
  - Simple Map-based implementation of `HubStore` interface
  - Used in tests and as a reference implementation
  - Not exported from main barrel (export from `@enkaku/hub-server/memory-store` subpath)

## Testing Strategy

### Unit tests (per-package, `test/` directory)

| Package | Test focus | Key coverage |
|---------|-----------|-------------|
| `@enkaku/group` | Crypto provider, credentials, group lifecycle | Noble provider correctness, capability validation, MLS state transitions |
| `@enkaku/hub-protocol` | Type inference | Protocol types produce correct client/server types |
| `@enkaku/hub-server` | Registry, handlers, hub creation | Fan-out routing, store-and-forward, tunnel proxying, auth |
| `@enkaku/hub-client` | Client wrapper | Auto-connect, encrypt/send, receive/decrypt, reconnection |

### Integration tests (`tests/integration/`)

Full client-server flows using DirectTransports. Two or three clients interacting via a hub with in-memory store. Tests exercise the complete stack: group creation → hub connection → encrypted messaging → member management.

### E2E tests (`tests/e2e-expo/`)

Validates Hermes runtime compatibility of the noble CryptoProvider. Critical because this is the highest-risk compatibility question. The test exercises:
- Ed25519 key generation (via `@noble/curves`)
- HKDF key derivation (via `@noble/hashes`)
- AES-GCM encrypt/decrypt (via `@noble/ciphers`)
- X25519 ECDH key agreement (via `@noble/curves`)
- HPKE encrypt/decrypt (built on above)
- Full MLS group create → invite → encrypt → decrypt cycle

Run on iOS simulator (Maestro) and Android emulator (Maestro) to confirm both platforms.

### What we do NOT test

- `ts-mls` internals (tested upstream, we test our integration)
- MLS RFC conformance (ts-mls's responsibility)
- Network transports (tested by existing Enkaku transport packages)
- HubStore implementations beyond in-memory (implementation-specific)

## Build & Configuration

Each new package follows the standard Enkaku package scaffold:

```
packages/[name]/
├── src/
│   ├── index.ts          # Barrel exports
│   └── [implementation]
├── test/
│   └── *.test.ts
├── package.json          # Standard scripts: build, test, lint
├── tsconfig.json         # Extends ../../tsconfig.build.json
└── README.md
```

**Dependencies to add to pnpm catalog:**
- `ts-mls: ^1.6.2`

**Workspace dependencies:**
- `@enkaku/group` → `ts-mls`, `@enkaku/token`, `@enkaku/capability`, `@noble/curves`, `@noble/hashes`, `@noble/ciphers`
- `@enkaku/hub-protocol` → `@enkaku/protocol`
- `@enkaku/hub-server` → `@enkaku/hub-protocol`, `@enkaku/server`, `@enkaku/group`, `@enkaku/stream`
- `@enkaku/hub-client` → `@enkaku/hub-protocol`, `@enkaku/client`, `@enkaku/group`

## Task Order & Dependencies

```
1.1 ts-mls spike ──→ 1.2 noble CryptoProvider ──→ 1.6 e2e-expo test
                  ──→ 1.3 credential model ──→ 1.4 GroupHandle ──→ 1.5 unit tests
                                                                ──→ 2.1 hub-protocol
                                                                ──→ 3.1 hub-server ──→ 3.3 server tests
                                                                ──→ 3.2 hub-client ──→ 3.4 client tests
                                                                                    ──→ 3.5 integration tests
                                                                                    ──→ 3.6 memory store
```

Phase 1 tasks (1.1–1.6) must complete before Phase 3. Phase 2 (2.1) can start after 1.4. Phase 3 tasks (3.1, 3.2) can run in parallel. Integration tests (3.5) depend on both server and client.
