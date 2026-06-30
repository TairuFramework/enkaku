# Replay Protection for Authenticated Messages — Design

**Date:** 2026-06-30
**Branch:** `replay-protection`
**Origin:** `docs/agents/plans/backlog/replay-protection.md` (June 2026 audit, `completed/2026-06-10-audit-remediation.complete.md`)

## Problem

The server never deduplicates authenticated messages. On signed RPC payloads
`jti`, `exp`, `iat` are all optional (`packages/protocol/src/schemas/client.ts`,
`@kokuin/token` `signedPayloadSchema`), and the auth path
(`packages/server/src/server.ts`) only verifies the signature and runs access
control. A captured signed message (request / event / stream / channel `send` /
`abort`) can therefore be replayed within its validity window.

For channel `send` and `abort` the only binding is `iss` matching the channel
owner, so an attacker who captures a victim's own messages can replay them.

`exp` is checked (`assertNonExpired`) only on the server-signer branch of
`checkClientToken`, and only when present — so the replay window is effectively
unbounded for tokens without `exp`.

Mitigating factors (why this is backlog, not urgent): TLS transports prevent
capture on the wire, and short-lived tokens bound the window. This work closes
the gap for deployments that cannot rely on those.

## Goals

- Deduplicate authenticated messages server-side within one process.
- Bound memory use without requiring a schema change (`jti`/`exp` stay optional).
- Reject stale captured messages even if the dedup store has not seen them
  (e.g. after a process restart).
- Secure-by-default when `requireAuth`, with a pluggable store for multi-instance
  deployments and a clean disable path.

## Non-goals

- `nbf` / future-clock-skew validation (not a replay concern).
- Cross-process / horizontally-scaled dedup out of the box — enabled by the
  pluggable `ReplayCache` interface but not shipped (Enkaku ships no persistence).
- Making `jti` or `exp` mandatory on the wire.

## Architecture

A new module `packages/server/src/replay.ts` defines the `ReplayCache`
interface, the in-memory default `MemoryReplayCache`, the `ReplayOptions` config
type, and a `checkReplay()` gate. The server installs a cache (default
in-memory, **server-wide** — shared across all transports/connections of one
`Server` instance) when `requireAuth`, and calls `checkReplay()` after
`verifyToken` succeeds at all three signed-message entry points in
`server.ts`:

1. The `process` auth path (request / event / stream / channel-open).
2. The `abort` case in the message loop.
3. The `send` case in the message loop.

No changes to `@kokuin/*` or to the protocol schemas.

## Components

### `ReplayCache` interface

```ts
export type ReplayCache = {
  /**
   * Atomically check whether `key` was already recorded, and record it.
   * Returns `true` if fresh (first sight), `false` if a replay.
   * `expiresAt` is the epoch-ms time after which the entry may be evicted.
   */
  checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean>
}
```

Atomic check-and-record (one call, not separate has/add) so a custom async
backend can implement it without a check-then-set race.

### `MemoryReplayCache` (default)

- Backing store: `Map<string, number>` (key → `expiresAt`).
- `checkAndRecord`: if key present and not expired → `false`; otherwise record
  `key → expiresAt` and return `true`. A present-but-expired entry is treated
  as absent (lazy expiry) and overwritten.
- `maxEntries` LRU cap as a DoS backstop; oldest entries evicted when exceeded.
- Injectable `now()` (default `Date.now`) for deterministic tests.

### `ReplayOptions` config type

```ts
export type ReplayOptions = {
  enabled?: boolean      // default true when requireAuth
  cache?: ReplayCache    // default MemoryReplayCache
  maxAge?: number        // ms; fallback window when no exp. default 60_000
  rejectStale?: boolean  // default true
  maxEntries?: number    // in-memory cap. default 10_000
}
```

Added to server params as `replay?: ReplayOptions`. Naming follows
`ServerAccessOptions` / `DelegationChainOptions`. Disable via
`replay: { enabled: false }` — no `| false` union. Omitted + `requireAuth` →
enabled with a default `MemoryReplayCache`. No effect when `requireAuth: false`
(unsigned messages have no `iss`/signature to key on).

## Data flow — `checkReplay(message, options)`

Runs after `verifyToken` succeeds, before the handler is invoked, on every
signed message:

1. Extract `iss`, `signature`, `jti`, `exp`, `iat` from the message; `now = now()`.
2. **Stale reject** (when `rejectStale`):
   - `exp != null && now > exp` → reject, reason `replay_stale`.
   - else `exp == null && iat != null && now > iat + maxAge` → reject, reason
     `replay_stale`.
3. `expiresAt = exp ?? (iat ?? now) + maxAge`.
4. `key = ${normalizeDID(iss)}:${jti ?? signature}`.
5. `fresh = await cache.checkAndRecord(key, expiresAt)`; if `!fresh` → reject,
   reason `replay_detected`.

**Key safety:** `jti`, `signature`, `iss`, `exp`, `iat` are all inside the
signed, integrity-protected payload/envelope. An attacker cannot strip `jti` to
change the key (that breaks the signature), nor mutate `exp`/`iat` to dodge the
staleness check. Keying on `jti ?? signature` means a message without `jti`
still gets a stable, non-malleable key (signature bytes, non-malleable thanks to
the already-shipped `lowS: true` ES256 verification).

Check-and-record runs even for messages that subsequently fail access control,
so a validly-signed-but-denied message also cannot be replayed. Memory stays
bounded by TTL + `maxEntries`.

## Error handling

- New stable wire code in `packages/protocol/src/error-codes.ts`:
  `EK09: REPLAY_DETECTED` (appended; codes are never renumbered/reused). Used for
  both `replay_detected` and `replay_stale` rejections.
- Reject builds a `HandlerError{ code: ErrorCodes.REPLAY_DETECTED }`. For
  non-`event` message types the error payload is sent to the client keyed by
  `rid` (mirrors the existing auth-failure path); for `event` no reply is sent.
- `emitHandlerError(events, 'auth', error, message.payload)` is emitted.
- OTel: `AUTH_REASON` set to `replay_detected` / `replay_stale`, `AUTH_ALLOWED`
  false, `ERROR_CODE` / `ERROR_MESSAGE` set on the span (consistent with the
  existing auth-denied spans).

## Testing

### `MemoryReplayCache` unit tests
- Fresh key → `true`; immediate duplicate → `false`.
- Entry past `expiresAt` (injected clock) → treated as fresh again.
- `maxEntries` cap evicts oldest; evicted key is fresh again.
- Lazy expiry overwrites a stale entry.

### Server integration tests
- Replaying an identical signed request → second is rejected with
  `EK09` / `ACCESS_DENIED`-style reply.
- Replay across two separate connections to the same `Server` → rejected
  (server-wide store).
- Stale message (old `iat`, no `exp`, beyond `maxAge`) → rejected when
  `rejectStale`; accepted when `rejectStale: false` and not a duplicate.
- Message without `jti` → replay still caught via signature key.
- Channel `send` replay and `abort` replay → rejected.
- `replay: { enabled: false }` → replays pass (behavior unchanged).
- Custom `cache` injected → it is the store consulted.
- Deterministic time via injected `now()` for expiry/staleness cases.

## Files

| File | Change |
|------|--------|
| `packages/server/src/replay.ts` | New — `ReplayCache`, `MemoryReplayCache`, `ReplayOptions`, `checkReplay`, `now` injection |
| `packages/server/src/server.ts` | Wire `replay` option; install default cache; call `checkReplay` at the 3 signed-message entry points |
| `packages/server/src/index.ts` (or equivalent export) | Export `ReplayCache`, `MemoryReplayCache`, `ReplayOptions` |
| `packages/protocol/src/error-codes.ts` | Append `REPLAY_DETECTED: 'EK09'` |
| `packages/server/test/replay.test.ts` | New unit + integration tests |

## Open considerations

- `maxAge` default of 60s is a starting point; tune against real token TTLs.
- Periodic active sweep vs lazy-only expiry for `MemoryReplayCache`: lazy +
  `maxEntries` cap is sufficient for the default; an interval sweep can be added
  later if idle-memory growth matters.
