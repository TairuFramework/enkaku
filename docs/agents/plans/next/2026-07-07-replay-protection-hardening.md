# Replay protection hardening

**Origin:** 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`), priority 1. Follows `completed/2026-07-01-replay-protection.complete.md` — the feature as shipped does not meet its stated threat model.

## Findings (verified in source)

- **Replay dedup key falls back to a deterministic signature** (`packages/server/src/replay.ts:123`). Client tokens carry only `iss` — no `jti`/`iat`/`exp` (`packages/client/src/client.ts:230-241`; `signToken` adds nothing beyond `iss`). Ed25519 signatures are deterministic, so two byte-identical legitimate messages (e.g. the same channel `send` payload twice, or two identical events) produce the same dedup key — the second is falsely rejected as `REPLAY_DETECTED`.
- **Staleness rejection is inert for the same reason** (`replay.ts:114-122`): with no `exp`/`iat` on client messages, the `rejectStale` branch never triggers, and `MemoryReplayCache.checkAndRecord` (`replay.ts:32`) treats an expired entry as fresh — a captured message is replayable after the 60s window. The protection currently reduces to a 60-second dedup.
- **A rejecting async replay cache kills the server read loop silently** — the `ReplayCache` type allows `Promise<boolean>`; a rejection produces no `transportError`, no dispose (`packages/server/src/server.ts:559, 651, 735`).

## Fix direction

1. Have the client add `jti` + `iat` to signed messages so dedup keys are unique per message and staleness has data to act on.
2. Add a clock-skew leeway option to the staleness check.
3. Fix `MemoryReplayCache.checkAndRecord` to treat expired entries as replay-window state, not fresh.
4. Wrap async replay-cache calls so a rejection surfaces as `transportError` instead of silently killing the read loop.
