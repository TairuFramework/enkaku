# Enkaku Roadmap

## Completed Goals (Jan-Mar 2026)

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

## Current Focus

- **Ledger root identity** — remaining work: MLS epoch key archival (Kubun scope), multi-Ledger support, Ledger app catalog submission

## Backlog (Low priority)

1. **Remaining discovery skills** — `/enkaku:utilities` and `/enkaku:platform` (nice-to-have, core discovery works without them)
2. **JWE multi-recipient** — `ECDH-ES+A256KW` key wrapping + JWE JSON Serialization (no known consumer demand)
3. **ts-mls stable upgrade** — update from pinned `2.0.0-rc.10` to `^2.0.0` when stable release ships
4. **TS 6 follow-ups** — Expo SDK compatibility, TS 7 `--stableTypeOrdering` fixes, Disposable types to es2025 lib, Electron Forge Vite 8 plugin
