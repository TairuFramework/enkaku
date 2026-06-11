# Enkaku Roadmap

## Completed Goals (Jan-Jun 2026)

- **Audit remediation (June 2026)** — Full-repo audit closed in four sequential plans: token-verification hardening (signature/payload binding, `verifiedPublicKey` bypass, ES256 lowS), transport stability (16 fail-closed edge fixes), hub hardening (mandatory identity, group authz, lifecycle leaks, long-lived limits), platform fixes (ChaCha AEAD dispatch, EK08 invalid-message reply, typed error-code registry, electron-rpc sender allowlist). See `completed/2026-06-10-audit-remediation.complete.md`

- **Security hardening** — Comprehensive audit (47 findings), 6 implementation waves, all critical/high items resolved
- **Message-level encryption** — JWE with ECDH-ES + A256GCM, identity type hierarchy, 4 envelope modes
- **Observability** — @enkaku/otel package, integrated across 10 packages, trace context propagation
- **Transport modernization** — SSE redesign with POST-based sessions, fetch + eventsource-parser
- **API refinement** — Unified `accessControl` parameter, event emitter rewrite (zero deps), downstream migration to Kubun/Mokei complete
- **Agent documentation** — Progressive discovery system (6 domain skills), AGENTS.md, capability docs
- **E2EE group communication** — @enkaku/group with MLS (ts-mls), hub protocol with fan-out routing, noble CryptoProvider for Hermes
- **ts-mls v2 migration** — CryptoProvider rewrite, DID-based AuthenticationService, full API migration
- **TS 6 + Vite 8 migration** — Restructured tsconfig hierarchy, test type-checking, `nodenext` resolution, SWC `esnext` target
- **Hardware identity** — @enkaku/ledger-identity (custom BOLOS app, Ed25519 + X25519), @enkaku/hd-keystore (BIP39/SLIP-0010)
- **Agent primitives** — @enkaku/capability (delegation, revocation), hub rewrite (blind relay, store-and-forward, ack semantics, opaque payloads)
- **MLS external rejoin + null-safety** — `joinGroupExternal` resync path, ratchet tree null-safety guards
- **Server/Client lifecycle** — Lifecycle events on Transport/Server/Client, benign teardown classification via `isBenignTeardownError`, `handlerError` discriminator (category × messageType)
- **Hub tunnel transport** — `@enkaku/hub-tunnel` ported from Kubun: peer-to-peer transport over HubLike relay with pluggable end-to-end encryption
- **Access control refactor** — Procedure-level policy enforcement consolidated
- **did:peer:4 identifiers** — PQ-friendly multi-key DIDs in `@enkaku/token`: multibase/multihash, `DIDResolver`/`DIDCache`, `MultiKeyIdentity`, rotation assertions, `signToken` unified API
- **did:peer:4 transport integration** — HTTP/WebSocket doc delivery, capability-layer cache threading, credential `longForm` plumbing
- **did:peer:4 MLS auth service** — Self-contained `createDIDAuthenticationService` with peer4 binding, single-shape `MLSCredentialIdentity` JSON, `MultiKeyIdentity` ↔ `OwnIdentity` unification, `joinGroupExternal` resync guard

## Current Focus

- **MLS capability-layer member revocation** — Production blocker for fresh external join. Capability-layer mechanism to evict members beyond MLS's stale-rejoin gap. Design between revocation token, GroupContext banlist extension, or hybrid.

## Near-term (ready when picked up)

- **peer4 auth-service polish** — Re-export `makeMLSCredential`, JSDoc on `createIdentity` / `IdentityKeySpec.privateKey`, decide on CHANGELOG convention
- **Ledger root identity remainder** — Multi-Ledger support (personal + organizational), Ledger app catalog submission. GroupArchiver moved to Kubun scope.

## Blocked / waiting upstream

- **peer4 MLS leaf rotation** — Blocked on ts-mls exporting `signLeafNodeUpdate` / `signWithLabel`. File upstream PR, vendor sign helper, or fall back to Remove+Add.
- **ts-mls v2.0.0 stable upgrade** — Pin bump from `2.0.0-rc.10` when stable lands.
- **TS 6 follow-ups** — Expo SDK TS 6 peer-dep, TS 7 `--stableTypeOrdering`, Disposable in es2025 lib, Electron Forge Vite 8 plugin.

## Longer-term

- **Post-quantum algorithms** — `paulmillr/noble-post-quantum` integration phased: (1) ML-DSA verifier-only, (2) Node + Electron signing, (3) JWE hybrid KEM (X25519+ML-KEM-768), (4) browser + Expo keystore refactor for large keys. Each phase its own design+plan.
- **JWE multi-recipient** — `ECDH-ES+A256KW` + JSON Serialization. Useful when GroupArchiver / multi-root archival needs land.
- **Remaining discovery skills** — `/enkaku:utilities` and `/enkaku:platform`. Nice-to-have.
- **Replay protection** — jti dedup / nonce design for authenticated messages (`backlog/replay-protection.md`).
- **MLS permission enforcement** — enforce admin/member/read on commits, sender- and receiver-side (`backlog/mls-permission-enforcement.md`); design with capability revocation.
- **Docs & release gaps** — stale website docs, README stubs, typedoc coverage, changesets (`backlog/docs-release-gaps.md`). Tracking only while consumers are stack-internal.
