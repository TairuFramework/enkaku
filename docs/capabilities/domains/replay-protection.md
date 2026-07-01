# Replay Protection — Detailed Reference

## Overview

Replay protection stops an attacker (or a buggy client) from re-sending a
previously-accepted, signed message and having the server act on it a second
time. Signature verification alone does not prevent this: a captured message is
byte-for-byte valid, so it verifies every time it is replayed. Enkaku's server
adds a deduplication layer that records each message it has already processed and
rejects any later message that reuses the same identity — returning the `EK09`
(`REPLAY_DETECTED`) error.

The feature lives entirely in the server (`@enkaku/server`). It is:

- **On by default** whenever the server authenticates messages (an `identity` is
  configured — see [When it is active](#when-it-is-active)).
- **Server-wide**: a single cache is shared across every transport/connection
  attached to one `Server` instance, so a message replayed on a different
  connection is still caught.
- **Pluggable**: the built-in cache is in-memory and process-local; supply your
  own [`ReplayCache`](#the-replaycache-interface) to persist or share dedup state
  across instances.

## Threat model

| Protects against | Does **not** protect against |
|---|---|
| Re-submitting a captured signed `event`, channel `send`, or channel `abort` to trigger the action again | Confidentiality of message contents (use encryption) |
| The same message replayed across different connections to one server | Replays across separate `Server` instances **unless** a shared/persistent `cache` is supplied |
| Stale messages resurfacing after their `exp`/`maxAge` window (when `rejectStale` is on) | A message with neither `exp` nor `iat` replayed after it is evicted from a bounded in-memory cache (see [Security considerations](#security-considerations)) |

Replay protection assumes the message has **already passed signature
verification** by the time it is checked. The server guarantees this ordering; a
custom cache never sees unverified input.

## When it is active

The server authenticates messages — and therefore runs replay protection — when
it is constructed with an `identity` (which fixes its `serverID`). A server
created without an identity must explicitly opt out of authentication
(`requireAuth: false`), and in that mode replay protection is off because there
are no verified signatures to key on.

```ts
// Authenticated server -> replay protection ON by default.
const server = serve({ handlers, identity, accessRules, transport })

// Unauthenticated server -> no verification, replay protection is a no-op.
const open = serve({ handlers, requireAuth: false, transport })
```

Which message types are checked: signed `event`, channel `send`, and channel
`abort`. For `send`/`abort` the replay check runs **before** the target
controller is looked up, so a replayed message still surfaces `EK09` even if the
channel it targeted has already been torn down.

## How it works

For each verified message the server computes a **dedup key** and asks the cache
whether it has been seen:

```
key = normalizeDID(payload.iss) + ":" + (payload.jti ?? message.signature)
```

- The key is **namespaced by issuer** (`iss`), so two different issuers can reuse
  the same `jti` value without colliding.
- If the message carries a `jti` (JWT ID) claim, that is used as the per-issuer
  discriminator; otherwise the message **signature** is used. Because the check
  only runs on signature-verified messages, both forms are tamper-safe — an
  attacker cannot forge a `jti`/signature that maps onto another issuer's key.

Each recorded entry has an **expiry** after which it may be dropped:

```
expiresAt = exp                      // if the token has an `exp` claim
          = (iat ?? now) + maxAge    // otherwise
```

Before recording, when `rejectStale` is enabled (the default), the message is
also checked for staleness and rejected up-front if it is already past its
window:

- If `exp` is present and `now > exp` → rejected as stale.
- Else if `iat` is present and `now > iat + maxAge` → rejected as stale.
- If neither claim is present, no staleness bound applies and the message is
  deduplicated only (see [Security considerations](#security-considerations)).

### Units

Token `exp`, `iat` (and `nbf`) claims are **epoch seconds**, per the JWT/token
convention. Everything internal to replay protection — `maxAge`, `expiresAt`, the
injected `now()` clock, and the value handed to `ReplayCache.checkAndRecord` — is
**milliseconds**. The seconds→milliseconds conversion happens once, internally,
when a message is checked. Keep this in mind when writing a custom cache or a
custom `now`.

## Configuration

Pass a `replay?: ReplayOptions` object to `serve()` / `new Server()`:

```ts
type ReplayOptions = {
  enabled?: boolean       // default true when the server authenticates
  cache?: ReplayCache     // default: a new in-process MemoryReplayCache
  maxAge?: number         // default 60_000 (ms) — window for messages without `exp`
  rejectStale?: boolean   // default true — reject already-expired/too-old messages
  maxEntries?: number     // default 10_000 — cap for the built-in cache
  now?: () => number      // default Date.now — injectable clock (ms), mainly for tests
}
```

| Option | Default | Purpose |
|---|---|---|
| `enabled` | `true` (when authenticated) | Set to `false` to disable replay protection entirely. |
| `cache` | new `MemoryReplayCache` | Plug in a persistent/shared backend (e.g. Redis). When supplied, `maxEntries` and the internal `now` are **not** passed to it — the cache owns its own storage and clock. |
| `maxAge` | `60_000` ms | Dedup/staleness window for messages that carry no `exp`. |
| `rejectStale` | `true` | Reject already-expired (`exp` in the past) or too-old (`iat + maxAge`) messages before the cache is consulted. |
| `maxEntries` | `10_000` | Bounds memory for the built-in `MemoryReplayCache`. Ignored when a custom `cache` is supplied. |
| `now` | `Date.now` | Injectable millisecond clock; primarily for deterministic tests. |

### Examples

```ts
// Disable replay protection.
serve({ handlers, identity, accessRules, transport, replay: { enabled: false } })

// Widen the fallback window for clients that omit `exp` and clock-skew tolerance.
serve({ handlers, identity, accessRules, transport, replay: { maxAge: 5 * 60_000 } })

// Accept stale-but-unique messages (dedup only, no staleness rejection).
serve({ handlers, identity, accessRules, transport, replay: { rejectStale: false } })

// Share dedup state across instances behind a load balancer.
serve({ handlers, identity, accessRules, transport, replay: { cache: myRedisCache } })
```

## The `ReplayCache` interface

```ts
type ReplayCache = {
  /**
   * Atomically check whether `key` was already recorded, and record it.
   * Returns `true` if fresh (first sight), `false` if a replay.
   * `expiresAt` is the epoch-millisecond time after which the entry may be evicted.
   */
  checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean>
}
```

The contract is a single atomic check-and-record. Returning `false` causes the
server to reject the message with `EK09`. The method may be synchronous or return
a `Promise` — the server always `await`s it.

**Atomicity matters.** Two identical messages can arrive close together; if the
"check" and the "record" are not atomic, both can observe "not seen" and pass.
The built-in `MemoryReplayCache` is safe because it performs the check and the
`Map` write with no `await` in between (JavaScript runs it to completion on one
turn of the event loop). A custom async cache (e.g. Redis) must provide the same
guarantee — for Redis, `SET key value NX PX <ttl-ms>` returns whether the key was
newly set, giving you an atomic first-writer-wins primitive:

```ts
// Sketch — a Redis-backed ReplayCache.
const cache: ReplayCache = {
  async checkAndRecord(key, expiresAt) {
    const ttl = Math.max(0, expiresAt - Date.now())
    const set = await redis.set(`replay:${key}`, '1', 'PX', ttl, 'NX')
    return set === 'OK' // OK => newly set (fresh); null => already present (replay)
  },
}
```

## `MemoryReplayCache`

The built-in default. Process-local, bounded, no persistence.

```ts
new MemoryReplayCache({ maxEntries = 10_000, now = Date.now })
```

- Stores `key → expiresAt` (epoch ms) in insertion order.
- A key whose stored `expiresAt` is still in the future is treated as a replay.
- **Eviction** (when over `maxEntries`): first drop entries whose `expiresAt` has
  already passed; if still over the cap, evict oldest-inserted entries (FIFO).

### Memory vs. replay trade-off

`maxEntries` bounds memory at the cost of a replay window: a flood of distinct
fresh keys can evict an older, not-yet-expired entry, after which that message
could be replayed successfully. Size `maxEntries` comfortably above your expected
in-flight message volume, or supply a persistent `cache` if that trade-off is
unacceptable for your threat model.

## Error handling & observability

A rejected message produces:

- A `HandlerError` with code `EK09` (`ErrorCodes.REPLAY_DETECTED`), sent back to
  the client for request-bearing messages (fire-and-forget `event`s get no reply).
- A `handlerError` server event in the `auth` category:

```ts
server.events.on('handlerError', ({ error, category }) => {
  if (error.code === 'EK09') {
    // category === 'auth' — a replay (or stale message) was rejected
  }
})
```

On the tracing side, the rejection sets the span's auth attributes
(`AUTH_REASON` = `replay_detected` | `replay_stale`, `AUTH_ALLOWED` = `false`)
and records the error, so replays are visible in OpenTelemetry output.

## Security considerations

- **Verification ordering.** Replay checks run only after signature verification.
  For `send`/`abort` the check was deliberately moved ahead of the
  controller-existence lookup, which also means an unsigned/invalid `send`/`abort`
  to an unknown channel now returns the same `ACCESS_DENIED` whether or not the
  channel exists — i.e. it does **not** leak channel existence.
- **Messages without `exp` or `iat`.** With `rejectStale` on but neither claim
  present, there is no staleness bound — the message is deduplicated only, using
  `now + maxAge` as its cache lifetime. Staleness cannot be enforced without a
  timestamp; require clients to send `exp` (or `iat`) if you need a hard bound.
- **Flood eviction.** See [Memory vs. replay trade-off](#memory-vs-replay-trade-off):
  a bounded in-memory cache can be pressured into evicting a live entry.
- **Custom-cache clock.** The server's `now` (used for staleness) is not injected
  into a custom `cache`; keep the two clocks consistent, and prefer a TTL derived
  from the `expiresAt` argument rather than an independent clock.
- **Cross-instance replays.** The default cache is per-process. Behind a load
  balancer, a message replayed against a *different* instance is not caught unless
  you supply a shared/persistent `cache`.
- **Known follow-up.** The dedup key is recorded before the message's encryption
  policy is checked, so a message that will fail the encryption check still
  consumes its key; a corrected retry that reuses the same `jti` would be rejected
  as a replay. Real clients use a fresh `jti`/signature per attempt, so impact is
  marginal.

## API quick reference

```ts
// from @enkaku/server
export class MemoryReplayCache {
  constructor(params?: { maxEntries?: number; now?: () => number })
  checkAndRecord(key: string, expiresAt: number): boolean
}

export type ReplayCache = {
  checkAndRecord(key: string, expiresAt: number): boolean | Promise<boolean>
}

export type ReplayOptions = {
  enabled?: boolean
  cache?: ReplayCache
  maxAge?: number
  rejectStale?: boolean
  maxEntries?: number
  now?: () => number
}

// Server option
serve({ /* ... */ replay?: ReplayOptions })
```

## Related capabilities

- [Securing Endpoints](../use-cases/securing-endpoints.md) — token-based
  authentication and access control (the layer replay protection builds on).
- [Core RPC](core-rpc.md) — procedure types (`event`, `send`, `abort`) and
  server message handling.
