# Ledger Root Identity — Follow-on Work

**Status:** pending (agent primitives complete, archival and multi-Ledger remain)

**Date:** 2026-03-25 (updated 2026-03-28)

**Prerequisites:**
- `completed/2026-03-26-ledger-identity.complete.md` — Ledger identity + HD keystore
- `completed/2026-03-28-agent-primitives.complete.md` — hub mailbox, revocation, delegation pattern

---

## Completed

- **Capability delegation pattern** — root identity adoption via `createCapability`, documented in agent primitives spec
- **Revocation primitive** — `RevocationRecord`, `RevocationBackend`, `createRevocationChecker` as `VerifyTokenHook`
- **Hub mailbox** — blind relay with ack semantics, pagination, opaque payloads

## Remaining Work

### GroupArchiver — MLS Epoch Key Archival (Kubun scope)

Scoped as a Kubun concern, not Enkaku. Enkaku provides the JWE encryption primitive (single-recipient, already exists). Kubun implements:

- Incremental archival: capture epoch key material, JWE-encrypt to root X25519 public key
- Snapshot archival: serialize group state periodically
- Recovery: Ledger ECDH to decrypt archived keys
- Configurable backend: hub endpoint, S3, local

### Future

- Multi-Ledger support (personal + organizational root identities)
- Ledger app submission to Ledger's app catalog
- JWE multi-recipient for simplified archival to multiple roots
