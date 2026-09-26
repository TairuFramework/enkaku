# server: bound replay for signed tokens

**Status:** complete
**Date:** 2026-09-26
**Packages:** `@enkaku/server`

Found by the kumiai hub replay audit (TairuFramework/kumiai#54). In authenticated mode, `checkReplay` applied no staleness bound to a verified token with neither `iat` nor `exp`. Its replay-cache entry expired `maxAge + leeway` after first sight. After that expiry, or after an eviction, the same signed message was accepted again, once per cache window. A far-future `exp` had a related gap: the token stayed valid until then, and an in-memory cache loses its entry on restart or eviction. Both gaps were closed together. This was a bounded change, so no separate spec or implementation plan was written; the source was the backlog note.

## What was built

- **Unbounded tokens refused.** When `rejectStale` is true (the default), a message with neither `iat` nor `exp` is refused with reason `replay_unbounded` before any cache write. The server replies `EK09` (`REPLAY_DETECTED`).
- **`replay.maxLifetime` cap** (milliseconds, default `300_000`). A token is refused as `replay_unbounded` when its validity end lies more than `maxLifetime + leeway` ahead of now. The validity end is `exp`, or `iat + maxAge` when `exp` is absent. `Infinity` disables the cap. `resolveReplay` throws when `maxLifetime < maxAge`, because every `iat`-only token would otherwise be refused.
- Tests: unit cases in `replay.test.ts`, end-to-end EK09 cases in `replay-server.test.ts`, and `iat` added to raw `signToken` fixtures in the server tests.
- `docs/reference/domains/replay-protection.md` updated, and a changeset for `@enkaku/server` added.

## Key design decisions

- **The cache entry never outlives a signed time bound.** Every accepted message (with `rejectStale` on) carries `iat` or `exp`, and its validity end is at most `maxLifetime` ahead. So the dedup window is always tied to the token's own validity.
- **The cap is measured from now, not as `exp - iat`.** An `exp - iat` cap misses a token with `iat` a year ahead and `exp` one minute after it. Measuring the validity end against now also catches a future-dated `iat` with no `exp`.
- **One reason, `replay_unbounded`,** covers both "no signed time bound" and "bound further than `maxLifetime`". The wire error is unchanged (`EK09`); the reason appears only in `ReplayCheckResult` and the span `AUTH_REASON` attribute.
- **`rejectStale: false` opts out of both checks.** That setting already opts out of time bounds, so it keeps dedup-only handling with a `now + maxAge + leeway` window.
- **Client `createToken` left as is.** It spreads the caller payload after its generated `jti` and `iat`, so a caller can override either claim. Such a message is now refused by the server unless it carries an `exp` within `maxLifetime`; this is documented rather than constrained.
- Standard enkaku clients stamp `iat` and no `exp`, so their validity end is `maxAge` (60 s) ahead and neither check affects them. Third-party signers that omit both claims, or set a far `exp`, are now refused.
