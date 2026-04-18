# Server/Client Teardown & Lifecycle Events — Design

**Date:** 2026-04-18
**Status:** spec
**Supersedes bug report:** [`2026-04-18-hub-server-teardown-unhandled-rejections.md`](./2026-04-18-hub-server-teardown-unhandled-rejections.md)
**Affected packages:** `@enkaku/async`, `@enkaku/transport`, `@enkaku/server`, `@enkaku/client`

## Context

The bug report documents unhandled `AbortError` and `TypeError: Invalid state: WritableStream is closed` rejections during clean hub channel teardown. Investigation found the issue is **not hub-specific**: it is a generic `@enkaku/server` + `@enkaku/client` lifecycle problem. Hub is merely the first noisy consumer.

This design fixes the rejections at their root and, while revisiting the teardown paths, introduces a coherent lifecycle-events surface on both `Client` and `Server` (and extends `TransportEvents`) so consumers can observe the full lifecycle without ad-hoc hooks. A future `ReconnectingTransport` wrapper is enabled by these events but is out of scope here.

## Root Causes (from investigation)

All rejections stem from fire-and-forget writes on a transport that has been closed or is mid-close. Identified sites:

- `packages/server/src/utils.ts:62` — `context.send(error.toPayload(...))` in `executeHandler` catch block, not awaited.
- `packages/server/src/server.ts:216` — `returned.then(() => {...})` has no `.catch`. Any rejection in the handler outer promise escapes.
- `packages/server/src/server.ts:95` — `send` closure returns `transport.write(...)` but is invoked fire-and-forget from several error/timeout paths (lines 112, 184, 197, 256, 489, 527, 536).
- `packages/client/src/client.ts:443` — `void this.#write({typ: 'abort', ...})` in `#handleSignal`. The `void` operator does not attach `.catch`.
- `packages/client/src/client.ts:451` — on abort reason `'Close'`, the controller is not deleted and `controller.aborted(signal)` is not called. Channel/stream call promises never settle after `close()` until dispose; a subsequent dispose race triggers the transport-closed rejection above.

## Goals

1. Zero unhandled rejections across clean and racing teardown paths.
2. Symmetric, observable lifecycle events on `Client`, `Server`, and `Transport`.
3. Centralize "is this error benign teardown?" classification so new write call sites stay safe by default.
4. Wire up the previously-declared-but-unused `handlerAbort` event with a reason discriminator.
5. Make `ChannelCall.close()` / `StreamCall.close()` settle the call promise.
6. Preserve existing layering: transport = bytes + source lifecycle; server/client = RPC lifecycle; shared util = error classification.

## Non-Goals

- Auto-reconnect logic. A future `ReconnectingTransport` wrapper will layer on these events but is specified separately.
- A source-availability abstraction (`up`/`down` stream/signal/emitter). Designed later together with the reconnect wrapper.
- Per-transport retry policies for `http-client-transport`, `socket-transport`, etc.

## Architecture

Three layers, unchanged boundaries:

| Layer | Concern | Changes |
|-------|---------|---------|
| `@enkaku/async` | Shared primitives | New `isBenignTeardownError(err)` util |
| `@enkaku/transport` | Bytes + source lifecycle | New events: `readFailed`, `disposing`, `disposed` |
| `@enkaku/server` | RPC server lifecycle | New `safeWrite`; wired lifecycle events; fixed rejection sites |
| `@enkaku/client` | RPC client lifecycle | New `ClientEvents` emitter + `safeWrite`; fixed `'Close'` path |

### Error classification

New module in `@enkaku/async` (`src/teardown.ts`), exported from the package index:

```ts
export function isBenignTeardownError(err: unknown): boolean
```

Returns true when the error represents a peer/local teardown rather than a real failure:

- `err` is an `Error` with `name === 'AbortError'`
- `err instanceof DisposeInterruption`
- `err.message` matches `/WritableStream is closed/`
- `err.message` matches `/(?:Writer|Reader).*closed/`
- `err` is the string `'Close'` or `'Transport'` (AbortSignal.reason propagated as-is)

Rationale: `DisposeInterruption` already lives in `@enkaku/async`, and both server and client (and transports) depend on it. No new package; no cyclical deps.

### Safe-write wrapper

Both `@enkaku/server` and `@enkaku/client` gain a small internal module (`safe-write.ts`) exposing:

```ts
safeWrite({
  transport,
  payload,
  rid,
  ctx, // disposing flag + event emitter + controller lookup
}): Promise<void>
```

Behavior:

1. `await transport.write(payload)`.
2. On throw, classify via `isBenignTeardownError`.
3. If benign AND (`ctx.disposing` OR the relevant controller signal is aborted with a benign reason):
   - Emit `writeDropped { rid?, reason, error }`.
   - Swallow.
4. Else:
   - Emit `writeFailed { error, rid? }` (server/client-level, not transport).
   - On the server side, abort the `rid` controller with reason `'Transport'`.
   - Rethrow so callers that await can still observe the failure.

The existing `transport.events.on('writeFailed', ...)` hook in `server.ts:141` is removed — its effect (abort inflight on write failure) now lives inside `safeWrite`. Transports may still emit their own `writeFailed` (e.g. HTTP server transport does) but server no longer depends on it.

All fire-and-forget call sites pass their rid so `safeWrite` can abort/drop correctly. `processHandler`'s `returned.then(...)` gets a matching `.catch` that routes any escape to `handlerError`.

## Events

### `TransportEvents` (extends existing)

| Event | Payload | When |
|-------|---------|------|
| `writeFailed` *(existing)* | `{ error, rid }` | Emitted by transports that have rid context (e.g. HTTP server); unchanged |
| `readFailed` | `{ error }` | Read loop failure in base `Transport`; caller still receives the throw |
| `disposing` | `{ reason? }` | Start of `Transport.dispose` |
| `disposed` | `{ reason? }` | After writer close, before `disposed` promise resolves |

### `ServerEvents` (extends existing)

Kept: `eventAuthError`, `handlerError`, `handlerTimeout`, `invalidMessage`.

| Event | Payload | When |
|-------|---------|------|
| `handlerStart` | `{ rid, procedure, type }` | Before handler invocation (per message) |
| `handlerEnd` | `{ rid, procedure }` | After handler cleanup, before controller removal |
| `handlerAbort` *(wire up existing declared type)* | `{ rid, reason }` | Every controller abort: client abort msg, timeout, dispose |
| `writeDropped` | `{ rid?, reason, error }` | Benign write swallowed |
| `disposing` | `{ reason? }` | `Server.dispose` start |
| `disposed` | `{ reason? }` | After all transports disposed (graceful or forced) |
| `transportAdded` | `{ transportID }` | `Server.handle` registers a transport |
| `transportRemoved` | `{ transportID, reason? }` | `handleMessages` returns |

`handlerAbort.reason` is a discriminated string: `'Close' | 'Timeout' | 'Transport' | 'DisposeInterruption' | string` (string when client provides a custom reason).

### `ClientEvents` (new)

New `EventEmitter<ClientEvents>` exposed on `Client.events` getter, symmetric to `Server.events`.

| Event | Payload | When |
|-------|---------|------|
| `requestStart` | `{ rid, procedure, type }` | Request/Stream/Channel created |
| `requestEnd` | `{ rid, procedure, status }` | Request settled; `status ∈ 'ok' \| 'error' \| 'aborted'` |
| `requestError` | `{ rid, error }` | Transport-level error affecting a request (not `RequestError` from server, which is in-band) |
| `writeDropped` | `{ rid?, reason, error }` | Benign write swallowed |
| `transportError` | `{ error }` | `#read` loop throws |
| `transportReplaced` | *(no data)* | `handleTransportDisposed`/`handleTransportError` returned a new transport |
| `disposing` | `{ reason? }` | `Client.dispose` start |
| `disposed` | `{ reason? }` | `Client.dispose` complete |

All events emit via existing `EventEmitter.emit` (async, `Promise.allSettled` internally; listener throws don't break the caller).

## Wiring

### `@enkaku/transport`

- Add the new events to `TransportEvents`.
- Base `Transport.dispose`: emit `disposing {reason}` first, then close writer, then emit `disposed {reason}`.
- Base `Transport.read`: wrap in try/catch, emit `readFailed {error}` before rethrow.
- `Transport.write` signature unchanged. `writeFailed` on generic base is **not** emitted (it lives with the server/client-level wrappers which have rid). Transport-specific implementations (e.g. HTTP server transport) keep their own `writeFailed` emission as they currently do.

### `@enkaku/server`

- `safeWrite` replaces the inline `send` closure at `server.ts:95`.
- `processHandler` attaches `.catch` to `returned.then(...)` — routes to `handlerError`.
- `handlerStart` / `handlerEnd` emitted at `processHandler` entry/cleanup.
- `handlerAbort` emitted at three sites:
  - Client `abort` message (server.ts:497) → reason = `msg.payload.rsn`
  - Timeout cleanup (server.ts:107) → reason = `'Timeout'`
  - Disposer (server.ts:132) → reason = `'DisposeInterruption'`
- `Server.dispose`: set `disposing` flag, emit `disposing`, await handling teardown (unchanged logic), emit `disposed`.
- `Server.handle`: emit `transportAdded` + `transportRemoved`.
- Existing `transport.events.on('writeFailed', ...)` hook deleted.

### `@enkaku/client`

- New `ClientEvents` + emitter wired into `Client`; exposed as `client.events`.
- `#write` uses `safeWrite`. Call sites that used `void this.#write(...)` (e.g. `#handleSignal` abort listener) are rewritten to call `safeWrite` directly.
- `#handleSignal` abort listener: on reason `'Close'`, still:
  - delete the controller from `#controllers`,
  - call `controller.aborted(signal)` so the call promise settles (rejects with `'Close'`).
  - This is a **behavior change** — see migration.
- `#read`: on throw, emit `transportError {error}` before the existing handler-dispatch logic; emit `transportReplaced` when replacement transport provided.
- `Client.dispose`: emit `disposing`, `#abortControllers(reason)`, await `transport.dispose()`, emit `disposed`.
- Request/Stream/Channel creation: emit `requestStart`. Controller `ok`/`error`/`aborted` callbacks emit `requestEnd` with matching status.

## Behavior change: `ChannelCall.close()` / `StreamCall.close()`

Previously, calling `close()` sent an abort message and left the call promise pending indefinitely (settled only on eventual client dispose). After this spec, `close()` settles the call promise with a rejection whose reason is `'Close'`.

Rationale:
- Avoids a controller leak (`#controllers[rid]` never cleaned up on close).
- Matches the intuitive semantic that "close = done".
- Eliminates a race window where the server's result-write lands on a disposing client transport.

Callers currently doing `await call.catch(() => {})` are unaffected. Callers that relied on the promise hanging after `close()` must adjust (none known in the repo).

## Testing

### New tests

- `packages/async/test/teardown.test.ts` — `isBenignTeardownError` truth table.
- `packages/server/test/safe-write.test.ts` — benign swallow + event emission; non-benign rethrow + `writeFailed` + controller abort.
- `packages/server/test/lifecycle-events.test.ts` — event sequences for: normal request, abort, timeout, handler error, server dispose.
- `packages/server/test/teardown-no-unhandled.test.ts` — regression test using `process.on('unhandledRejection')` guard; reproduces the original symptom minus hub (minimal protocol with one channel procedure).
- `packages/client/test/safe-write.test.ts` — mirror server version.
- `packages/client/test/lifecycle-events.test.ts` — `requestStart`/`requestEnd`/`transportError`/`disposing`/`disposed` sequences.
- `packages/client/test/close-settles.test.ts` — `close()` settles with rejection `'Close'`.
- `tests/integration/teardown.test.ts` — full client-server channel open/close/dispose permutations; asserts zero unhandled rejections.

### Updated tests

- `packages/transport/test/lib.test.ts` — assert new events fire.
- `packages/hub-server/test/hub.test.ts` — add the spec's original repro as a regression case.
- `packages/server/test/controller-timeout.test.ts`, `dispose-timeout.test.ts`, `stream-crash.test.ts` — verify still green; update any assertions that depended on the old lingering-controller-on-`'Close'` behavior.

### Tooling

- Vitest already fails on unhandled rejection — used as implicit check across suites.
- `dangerouslyIgnoreUnhandledErrors` must not be used.

## Migration

**Breaking (consumer-visible):**

1. `ChannelCall.close()` / `StreamCall.close()` settle the call promise with rejection `'Close'`. Consumers using `await call.catch(() => {})` are unaffected.

**Additive (non-breaking):**

1. New events on `TransportEvents`, `ServerEvents`, and a new `ClientEvents` emitter.
2. `Client.events` getter — new API.
3. `@enkaku/async` exports `isBenignTeardownError`.

**Internal-only:**

- `safe-write` modules in server and client are not part of the public API.
- `transport.events.on('writeFailed', ...)` subscription inside server is removed. Transports that emit `writeFailed` themselves are unaffected; consumers that subscribed to a transport's `writeFailed` continue to work.

No backwards-compat shims needed.

**Versioning:** minor bump across `@enkaku/async`, `@enkaku/transport`, `@enkaku/client`, `@enkaku/server`. Changelog entries:

- **Fixed:** unhandled rejections during client/server teardown and channel close races.
- **Added:** lifecycle events on `Client`, `Server`, `Transport`; `isBenignTeardownError` helper.
- **Behavior change:** `channel.close()` / `stream.close()` now settle the call promise with a `'Close'` rejection.

## Rollout order

1. `@enkaku/async`: add `isBenignTeardownError` + export.
2. `@enkaku/transport`: add new events, wire into base class.
3. `@enkaku/server`: add `safeWrite`, wire events, fix `returned.then` catch, wire `handlerAbort`, remove transport `writeFailed` subscription.
4. `@enkaku/client`: add `ClientEvents` + emitter + `safeWrite`, fix `'Close'` path, wire events.
5. Tests per the testing section.
6. Update `docs/agents/architecture.md` and any website docs referencing events.

## Out of scope (future specs)

- `ReconnectingTransport` wrapper (uses the new events; owns backoff and availability logic).
- Source-availability abstraction (shape TBD together with the reconnect wrapper).
- Per-transport retry policies.
