# Ledger Root Identity — Follow-on Work

**Status:** pending (Ledger identity implementation complete, delegation and archival remain)

**Date:** 2026-03-25 (updated 2026-03-26)

**Prerequisite:** `feat/ledger` branch (completed 2026-03-26) — see `completed/2026-03-26-ledger-identity.complete.md`

---

## Remaining Work

### GroupArchiver — MLS Epoch Key Archival

Extension to `@enkaku/group` for archiving MLS-encrypted messages recoverable only by the root identity (Ledger).

- **Incremental archival:** capture `SecretTree` per epoch transition, JWE-encrypt to root X25519 public key
- **Snapshot archival:** serialize full `ClientState` periodically, JWE-encrypt to root
- **Recovery:** latest snapshot + incremental epoch archives → decrypted message history (requires Ledger for ECDH)
- **Configurable backend:** hub endpoint, S3, local

### Capability Delegation UX

The capability system already supports delegation chains. Needs:

- CLI/UI workflow for delegating from Ledger root to device identity
- Capability revocation list (use `verifyToken` hook in `DelegationChainOptions`)

### Future

- Multi-Ledger support (personal + organizational root identities)
- Ledger app submission to Ledger's app catalog
- JWE multi-recipient for simplified archival to multiple roots
