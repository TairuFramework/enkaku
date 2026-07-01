# Replay Protection for Authenticated Messages — Completed

**Date:** 2026-07-01
**Status:** complete
**Branch:** `replay-protection` (PR #46)
**Origin:** backlog item from the June 2026 audit (`completed/2026-06-10-audit-remediation.complete.md`)

## Goal

Close a server-side replay gap: authenticated messages were never deduplicated,
so a captured signed `event` / channel `send` / `abort` could be replayed within
its validity window (unbounded when the token carried no `exp`). Channel
`send`/`abort` were only bound to `iss`, so an attacker replaying a victim's own
captured messages would pass.

## What was built

A self-contained replay layer in `@enkaku/server` (`packages/server/src/replay.ts`)
plus wiring in the server message loop and a new stable error code. No changes to
`@kokuin/*` or the protocol schemas — `jti`/`exp`/`iat` stay optional on the wire.

- **`ReplayCache` interface** — single atomic `checkAndRecord(key, expiresAt)`.
- **`MemoryReplayCache`** — in-memory default: `Map<key, expiresAt>`, lazy expiry,
  `maxEntries` FIFO cap (default 10_000) as a DoS backstop, injectable `now()`.
- **`ReplayOptions`** server param (`replay?: ReplayOptions`): `enabled`, `cache`,
  `maxAge` (ms, default 60_000), `rejectStale` (default true), `maxEntries`.
- **`checkReplay()` gate** called after `verifyToken` succeeds at the three
  signed-message entry points (process/auth path, channel `send`, channel `abort`).
- **`EK09 REPLAY_DETECTED`** appended to the protocol error-code registry; rejects
  emit a `handlerError` in the `auth` category and set the OTel auth-reason span
  attributes (`replay_detected` / `replay_stale`).
- **Docs:** dedicated reference at `docs/capabilities/domains/replay-protection.md`
  (threat model, config, custom `ReplayCache` incl. a Redis sketch, security
  considerations); the `@enkaku/server` module comment is kept clean.

## Key design decisions (preserved from the spec)

- **Dedup key = `${normalizeDID(iss)}:${jti ?? signature}`.** Issuer-namespaced so
  two issuers can reuse a `jti` without colliding; falls back to the signature when
  `jti` is absent. Tamper-safe because the gate only runs on signature-verified
  messages (and ES256 verification is already `lowS`, so signatures are
  non-malleable).
- **TTL = `exp ?? (iat ?? now) + maxAge`;** staleness rejected up-front when
  `rejectStale` and a timestamp is present. A message with neither `exp` nor `iat`
  is deduplicated only (no staleness bound — cannot bound without a timestamp).
- **On by default when the server authenticates** (`identity` set → `requireAuth`);
  **server-wide** single cache shared across all transports of one `Server`;
  disable via `replay: { enabled: false }` (dedicated type, no `| false` union).
- **Pluggable, not persistent.** Enkaku ships the in-memory cache only; multi-instance
  dedup is enabled through a custom `cache` but not shipped.

## Post-review change

The whole-branch review flagged that `send`/`abort` checked controller-existence
*before* verification, so a replayed message to an already-torn-down controller
silently no-op'd without `EK09`. The verification + replay check was moved ahead
of the controller lookup (issuer-match stays after, since it needs the
controller). Side benefit: unsigned/invalid `send`/`abort` now return identical
`ACCESS_DENIED` regardless of controller existence — removing a controller-existence
oracle.

## Verification

Built via subagent-driven development (4 tasks, per-task review) + a whole-branch
review (no blocking issues) + a focused re-review of the reorder. Full repo green:
`pnpm test` 26/26 tasks, `pnpm run lint` warning-free across 184 files. 13 replay
unit tests + 10 server integration tests.

## Known follow-ups

Extracted to `docs/agents/plans/backlog/replay-protection-followups.md` (both Minor,
non-blocking): replay key recorded before the encryption-policy check; the three
near-duplicate replay-gate blocks could share a helper.
