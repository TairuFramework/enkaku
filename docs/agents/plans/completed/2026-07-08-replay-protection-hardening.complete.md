# Replay Protection Hardening — Completed

**Date:** 2026-07-08
**Status:** complete
**Branch:** `replay-protection-hardening`
**Origin:** priority-1 item from the 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`), following on from `completed/2026-07-01-replay-protection.complete.md`.

## Goal

The 2026-07-01 replay layer built the server-side machinery but did not meet its
threat model in practice: the **client never populated `jti`/`iat`**. So the
server's dedup key fell back to the (deterministic Ed25519) `message.signature`
— two byte-identical legitimate messages collided and the second was falsely
rejected `REPLAY_DETECTED` — and the staleness check had no timestamp to act on.
Plus three narrower server hardening gaps.

## What was built

Four changes across client and server; no protocol-schema or `@kokuin/*` changes
(`jti`/`iat`/`exp` stay optional on the wire).

- **Client `jti`/`iat` injection** (`@enkaku/client`, `packages/client/src/client.ts`).
  `getCreateMessage` now stamps every **signed** message before signing: `jti` =
  `runtime.getRandomID()` (crypto.randomUUID, unique per message → unique dedup
  keys) and `iat` = current time in **seconds** (token convention; the server
  multiplies by 1000). Threaded a `now: () => number` (epoch ms) plus the runtime's
  `getRandomID` from the constructor; added optional `now?` to `ClientParams` for
  deterministic tests (default `Date.now`). The unsigned path is untouched —
  replay protection only runs in authenticated mode.
- **Clock-skew leeway** (`@enkaku/server`, `packages/server/src/replay.ts`).
  New `leeway?` option (ms, default `5_000`) on `ReplayOptions`/`ResolvedReplay`.
  Staleness now rejects only past `exp + leeway` (exp path) or
  `iat + maxAge + leeway` (iat path), tolerating bounded clock skew.
- **Cache-expiry margin** (`replay.ts`). The recorded `expiresAt` is extended to
  `(exp ?? (iat ?? now) + maxAge) + leeway`, so a cache entry lives exactly as
  long as the message stays acceptable to the staleness check — a captured
  message cannot be replayed during the leeway tail. `MemoryReplayCache`
  internals unchanged.
- **Async replay-cache rejection guard** (`packages/server/src/server.ts`). The
  three `await checkReplay` sites (the `process` auth path, and the `abort` /
  `send` cases in `handleNext`) are wrapped in try/catch. On rejection: emit
  `transportError` (cause wrapped as `Error('Replay cache check failed')`),
  `await disposer.dispose()`, and `return` — fail-stop. Rationale: if the replay
  backend is unreachable, tear the connection down rather than process a message
  of unknown replay status. Previously a rejecting custom async `ReplayCache`
  surfaced as an unhandled rejection that silently killed the read loop. The
  built-in `MemoryReplayCache` is synchronous and never hit this path.

## Key design decisions (preserved from the spec)

- **`jti`/`iat` on the signing path only.** Unsigned tokens carry neither and
  never reach the replay gate (`resolveReplay` returns `null` when `!requireAuth`).
- **No client-set `exp`.** The server's `maxAge` window governs staleness; a
  client-chosen `exp` was deemed YAGNI.
- **`iat` in seconds, converted server-side.** Matches the existing token claim
  convention; the server does the `* 1000` at the one comparison site.
- **Fail-stop on cache failure, uniform across message types.** Even `event`
  messages (no `rid` to reply on) dispose the transport rather than attempt a
  per-message error — the only meaningful signal when the backend is down.
- **Signature fallback in the dedup key is now a residual, not the norm.**
  Enkaku's own client always sends `jti`; `${iss}:${jti ?? signature}` only falls
  back for third-party clients that omit it, and only after signature verification.

## Verification

Built via subagent-driven development (3 tasks, per-task spec+quality review) plus
a whole-branch review — verdict **SHIP**, no blocking defects, threat gap confirmed
closed end-to-end (iat units align, jti unique across all six client payload shapes,
no payload field can clobber the stamped claims, fail-closed before any handler
runs). Full repo green: `pnpm run test` 48/48 tasks, `pnpm run lint` clean across
185 files. New tests: server leeway/margin block, client `replay-claims` suite, and
async-rejection coverage for all three guard sites (`process`, `abort`, `send`),
each verified non-vacuous.

Two follow-ups were closed on-branch: the whole-branch review flagged that only the
`process`-path guard was tested (added `abort`/`send` variants); and QA caught a
downstream standalone event test asserting the exact pre-`jti`/`iat` token, relaxed
to capture the observed claims and rebuild the expected message (mirroring the
client `lib.test.ts` relaxation).

## Known minors (accepted, not actioned)

- **Exact-millisecond boundary seam.** Both the staleness check and
  `MemoryReplayCache` are inclusive at the boundary, so a replay arriving at
  exactly `now === expiresAt` is accepted — a 1 ms window requiring sub-millisecond
  clock alignment. Non-threat in practice.
- **Possible duplicate `transportError`.** After a guard disposes, the trailing
  fire-and-forget `handleNext()` read can reject and emit a second
  `transportError` ('Transport read failed'). Harmless (dispose is idempotent),
  just noisier logs.
