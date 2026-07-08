# Replay protection hardening — design

**Date:** 2026-07-08
**Origin:** `docs/agents/plans/next/2026-07-07-replay-protection-hardening.md` (priority 1 from the 2026-07-03 repo audit).

## Context

The 2026-07-03 audit flagged that replay protection, as shipped in `completed/2026-07-01-replay-protection.complete.md`, did not meet its stated threat model. Since then, commit `cbdce41` (`feat(server): replay protection for authenticated messages`, #46) rebuilt the **server** side: `packages/server/src/replay.ts` now handles `jti`/`iat`/`exp`, an expiry-aware `MemoryReplayCache`, and an async `checkReplay`. The audit doc predates that commit and overstates the remaining work.

The gap that remains: the **client never populates `jti`/`iat`**, so the server's dedup key falls back to the (deterministic Ed25519) `message.signature` and its staleness check has no data to act on. Plus two independent hardening items on the server.

### Verified current state

- `packages/client/src/client.ts` — `getCreateMessage` (~230) signs the raw payload via `id.signToken(payload, { header })`, adding nothing beyond `iss`. No `jti`, no `iat`.
- `packages/server/src/replay.ts:123` — dedup key is `` `${normalizeDID(iss)}:${jti ?? message.signature}` ``. With no `jti`, two byte-identical legitimate messages collide → second falsely rejected `REPLAY_DETECTED`.
- `packages/server/src/replay.ts:114-119` — `rejectStale` branch is inert without `exp`/`iat`.
- `packages/server/src/server.ts:559, 651, 735` — three unguarded `await checkReplay` sites. A rejecting async `ReplayCache` propagates an unhandled rejection that kills the read loop silently (the trailing `handleNext()` never runs). The default `MemoryReplayCache` is synchronous and never hits this; only a custom async cache does.
- `getRandomID` (`@sozai/runtime`) = `crypto.randomUUID()` — already threaded through the client runtime; suitable as the `jti` source.

## Scope

Four changes, all confirmed in scope:

1. Client `jti` + `iat` injection (core — fixes the linchpin).
2. Clock-skew leeway on the server staleness check.
3. Cache-expiry margin so a replay can't slip through the leeway window.
4. Async-cache rejection guard on the server read loop.

Out of scope: client-set `exp` (server `maxAge` window governs staleness — YAGNI); changing `MemoryReplayCache` internals.

## Design

### 1. Client `jti`/`iat` injection — `packages/client/src/client.ts`

In `getCreateMessage`'s `createToken`, before signing, stamp every signed message payload:

- `jti`: `runtime.getRandomID()` (crypto.randomUUID — unique per message, so dedup keys are unique).
- `iat`: current time in **seconds** (token convention; server multiplies by 1000 at `replay.ts:111`).

`getCreateMessage` gains the runtime's `getRandomID` and a `now: () => number` (epoch ms) so `iat` is computed as `Math.floor(now() / 1000)`. Add an optional `now?: () => number` to `ClientParams` (default `Date.now`) for deterministic tests, and thread both `getRandomID` and `now` from the `Client` constructor into `getCreateMessage`.

`jti`/`iat` are added only on the signing path (identity present). Unsigned tokens are unchanged — replay protection only runs in authenticated mode (`resolveReplay` returns `null` when `!requireAuth`).

This fixes finding #1 and gives the staleness check (#2) real data to act on.

### 2. Clock-skew leeway — `packages/server/src/replay.ts`

Add `leeway?: number` (milliseconds) to `ReplayOptions` and `ResolvedReplay`. Default `5_000`. Resolved in `resolveReplay` alongside `maxAge`.

Apply in `checkReplay`'s `rejectStale` branch:
- `exp` path: reject stale if `now > expMs + leeway`.
- `iat` path: reject stale if `now > iatMs + maxAge + leeway`.

### 3. Cache-expiry margin — `packages/server/src/replay.ts`

`MemoryReplayCache` internals unchanged (its "an expired entry is fresh again" behaviour and existing test stay valid). The fix is in `checkReplay`: extend the recorded `expiresAt` to cover the full acceptance window, so a captured message cannot be replayed during the leeway tail:

```
expiresAt = (expMs ?? (iatMs ?? now) + maxAge) + leeway
```

The cache entry then lives exactly as long as the message remains acceptable to the staleness check.

### 4. Async-cache rejection guard — `packages/server/src/server.ts`

Wrap each of the three `await checkReplay` sites (559 inside `process`; 651 and 735 inside the `handleNext` switch) in try/catch. On rejection, fail-stop (audit fix direction #4):

```
events.emit('transportError', { error })
await disposer.dispose()
return
```

`return` (not `break`) so the read loop unwinds cleanly and the trailing `handleNext()` does not re-enter. Rationale: if the replay backend is unreachable, tear down the connection rather than process a message whose replay status is unknown. Wrap the caught cause in an `Error('Replay cache check failed', { cause })` to match the existing `transportError` shape at server.ts:590.

## Data flow

Authenticated client message → client stamps `jti` (uuid) + `iat` (seconds) → signs → transport → server verifies signature → encryption gate → `checkReplay`:
1. Staleness: reject if past `exp+leeway` or `iat+maxAge+leeway`.
2. Dedup: key `iss:jti`, record with `expiresAt = window + leeway`. Duplicate `jti` within the window → `REPLAY_DETECTED`.

Distinct legitimate messages now always carry distinct `jti` → no false rejection. A captured message is unreplayable for the full acceptance window.

## Error handling

- Client with no signing identity: unchanged, no `jti`/`iat`, no replay path.
- Replay detected / stale: existing `REPLAY_DETECTED` HandlerError path (unchanged).
- Async replay-cache rejection: `transportError` emitted + transport disposed (new).

## Testing

- **Client** (`packages/client/test/`): a signed message payload carries a `jti` (uuid) and integer `iat` (seconds); two messages get distinct `jti`; injected `now`/`getRandomID` produce deterministic values; unsigned client emits neither field.
- **Server** (`packages/server/test/replay.test.ts`, `replay-server.test.ts`):
  - Two byte-identical payloads with distinct `jti` both pass (regression for #1).
  - Duplicate `jti` within window → `replay_detected`.
  - `iat` older than `maxAge + leeway` → `replay_stale`; within leeway → passes.
  - `expiresAt` includes leeway: a `jti` replayed just after `maxAge` but within leeway is still rejected as a replay.
  - A rejecting async `ReplayCache` → `transportError` emitted and transport disposed, read loop does not hang (covers all three call sites, including `abort` and `send`).

## Files touched

- `packages/client/src/client.ts` — `jti`/`iat` injection, `now`/`getRandomID` threading, `ClientParams.now`.
- `packages/server/src/replay.ts` — `leeway` option, staleness leeway, `expiresAt` margin.
- `packages/server/src/server.ts` — try/catch guard at the three `checkReplay` sites.
- Client + server tests as above.
