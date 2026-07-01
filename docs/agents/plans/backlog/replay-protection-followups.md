# Replay Protection — Follow-ups

**Origin:** whole-branch review of the `replay-protection` feature
(`completed/2026-07-01-replay-protection.complete.md`). Both Minor, non-blocking.

## 1. Replay key recorded before the encryption-policy check

In `packages/server/src/server.ts`, the `process` auth path calls `checkReplay`
(which records the dedup key) before `checkMessageEncryption`. A message that then
fails the encryption check has already consumed its key, so a corrected encrypted
retry reusing the same `jti` would be rejected as a replay.

Impact is marginal — real clients use a fresh `jti`/signature per attempt. Fix
option: run the encryption check before `checkReplay`, or only record after the
message is fully admitted. Weigh against the design intent of "record even for
denied messages" (so a validly-signed-but-denied message cannot be replayed).

## 2. Extract the shared replay-gate helper

The three replay-rejection blocks (process / `send` / `abort` in `server.ts`) are
near-identical — build `HandlerError{ REPLAY_DETECTED }`, optionally reply by `rid`,
`emitHandlerError(..., 'auth', ...)`, then stop. The `process` path additionally
sets span attributes. A small `handleReplayFailure(...)` helper would cut ~40 lines
and is worth doing if a fourth call site ever appears. Cosmetic only.
