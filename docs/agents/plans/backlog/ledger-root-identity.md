# Ledger Root Identity — Enkaku-side remainder

**Status:** backlog
**Predecessors:**
- `completed/2026-03-26-ledger-identity.complete.md` — Ledger identity + HD keystore
- `completed/2026-03-28-agent-primitives.complete.md` — hub mailbox, revocation, delegation pattern

## Context

Original plan covered the full root-identity story spanning Enkaku primitives and Kubun integration. Enkaku-side primitives are complete:

- Capability delegation pattern via `createCapability`
- Revocation: `RevocationRecord`, `RevocationBackend`, `createRevocationChecker` as `VerifyTokenHook`
- Hub mailbox with ack/pagination/opaque payloads

GroupArchiver (MLS epoch key archival) is Kubun scope — tracked in the Kubun repo, not here. Enkaku already exposes the single-recipient JWE primitive Kubun needs. Multi-recipient JWE for archival to multiple roots tracked separately in `backlog/2026-01-30-jwe-multi-recipient.md`.

## Enkaku-side remaining work

### Multi-Ledger support

Allow personal + organizational root identities on separate Ledger devices. Today `@enkaku/ledger-identity` assumes one connected device. Surface area:

- Multiple `LedgerIdentity` instances against distinct transports/sessions.
- Identity selection UX deferred to consumer apps; framework just needs not to assume a single device.

### Ledger app catalog submission

Submit the custom BOLOS app to Ledger's app catalog. Out-of-band work (paperwork, audits, signing) — track separately when prioritized.

## Out of scope

- GroupArchiver (Kubun).
- JWE multi-recipient (separate backlog item).
