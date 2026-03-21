# MLS, Groups & Hub — E2EE Group Communication

**Status:** complete

**Branch:** `feat/mls-groups-hub`

---

## Goals

1. **Multi-device sync** — E2E encrypted communication between a user's devices
2. **Multi-user groups** — Contacts, families, teams sharing data with group key management
3. **Zero-knowledge relay** — Hub server routes encrypted messages without accessing content

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MLS implementation | `ts-mls` library (not custom) | RFC 9420 is 132 pages of security-critical code. ts-mls is actively maintained, pure TypeScript, immutable API. |
| Hermes support | Pure `@noble/*` CryptoProvider | ts-mls's default providers depend on `crypto.subtle` (via `@hpke/core`). Custom provider implements HPKE RFC 9180 using `@noble/curves`, `@noble/hashes`, `@noble/ciphers`. |
| Hub server type | Standard `serve()` with HubProtocol | Hub protocol maps to Enkaku's four procedure types. Fan-out/routing is handler-level state (HubClientRegistry), not a framework concern. |
| Identity/credentials | Enkaku capabilities as MLS credentials | DID + delegation chain. Root capability uses wildcard `act: '*'`, delegated capabilities use specific permissions (`member`, `read`). `sub` stays constant through chain, `aud` identifies the delegate. |
| Dual validation | Capability (hub + client) + MLS (client only) | Hub validates credentials at join time. Clients validate both MLS signatures and capability chains. Two-phase revocation: immediate hub block + deferred key rotation. |
| Wire format | Binary for MLS crypto core, JSON for transport | ts-mls handles binary encoding. Hub protocol uses JSON via standard Enkaku transport. |
| Group size | Up to ~100 members | TreeKEM O(log n) keeps operations fast. Covers device groups, families, teams. |
| Store-and-forward | Destructive dequeue via HubStore interface | Key packages are single-use (MLS semantics). Queued messages consumed on delivery. |

---

## What Was Built

**`@enkaku/group`** — Group identity and membership (40 tests)
- Pure `@noble/*` CryptoProvider implementing HPKE RFC 9180 for Hermes compatibility
- Credential model bridging Enkaku capabilities with MLS basic credentials
- GroupHandle class wrapping ts-mls state with encrypt/decrypt/processMessage
- Lifecycle functions: createGroup, createInvite, commitInvite, processWelcome, removeMember, createKeyPackageBundle
- Capability helpers: createGroupCapability, delegateGroupMembership, validateGroupCapability

**`@enkaku/hub-protocol`** — Protocol types (6 tests)
- HubProtocol with 7 procedures: send, receive, tunnel/request, keypackage/upload, keypackage/fetch, group/join, group/leave
- RoutedMessage and HubStore types

**`@enkaku/hub-server`** — Message routing server (30 tests)
- HubClientRegistry for connected client state and group memberships
- Fan-out routing, store-and-forward via HubStore, tunnel relay
- In-memory HubStore for testing
- Two-client integration test with signed identities

**`@enkaku/hub-client`** — Client convenience wrapper (4 tests)
- HubClient class with typed methods for send, receive, joinGroup, leaveGroup, key package management

**`tests/e2e-expo`** — Hermes compatibility test
- Group E2EE button exercising full MLS lifecycle with nobleCryptoProvider
- Maestro test for automated verification
- crypto.getRandomValues polyfill via expo-crypto

---

## Follow-on Work

- Hub credential validation in `hub/group/join` (TODO — currently accepts any join when accessControl is false)
- Kubun sync integration (separate spec, out of scope)
