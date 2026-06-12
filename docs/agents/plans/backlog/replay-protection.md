# Replay Protection for Authenticated Messages

**Priority:** backlog (security hardening; mitigated by TLS transports + short-lived tokens)
**Origin:** June 2026 audit (`completed/2026-06-10-audit-remediation.complete.md`)

## Problem

The server never deduplicates `jti` and `exp` is optional on RPC message payloads (`packages/protocol/src/schemas/client.ts`), so a captured signed message (request/event/abort/send) can be replayed within its validity window (`packages/server/src/server.ts:443-519` auth path). For channel `send`/`abort` the only binding is `iss` match to the channel owner, so replaying a victim's own messages is possible.

## Sketch

Candidate designs (to be brainstormed):

1. **Per-connection jti window** — Server tracks seen `jti` values per transport session in a bounded LRU/time-window structure. Rejects duplicates. Memory-bounded, resets on reconnect (acceptable: rids are session-scoped anyway).
2. **Monotonic nonce** — Client includes an incrementing counter; server tracks high-water mark per issuer DID. Cheaper memory, but breaks with concurrent clients sharing an identity and needs persistence semantics.
3. **Require `exp` + jti window** — Make `exp` mandatory (or default) on signed RPC messages so the dedup window has a hard bound; document the clock-skew tolerance.

## Dependencies

- `lowS: true` ES256 verification already shipped (token-verification-hardening plan) — signatures are non-malleable, so signature bytes or `jti` can safely key a dedup set.

## Notes

- Decide where enforcement lives: `Server` message loop vs `access-control.ts` `checkClientToken`.
- Channel semantics: `send` messages on a long-lived channel are frequent — per-message jti may be wasteful; consider requiring jti only on session-establishing messages (request/channel/stream) and binding sends to the channel's rid + sequence.
- Revocation backend exists (`packages/capability/src/revocation.ts`) but is unrelated plumbing; do not conflate.
