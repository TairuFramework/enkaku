# Request abort before `sent` settles — design

Source: `docs/agents/plans/backlog/2026-10-22-request-abort-before-sent.md` (section 1).

## Intent

kumiai caps unsettled requests at four. Over `@enkaku/http-fetch`, aborting a request whose response the
server withholds does not free a slot: the call promise and `abort()` both wait on `sent`, which is the
whole `fetch` round trip. Both needs are wanted: (1) the call settles on abort, (2) the HTTP fetch is
cancelled so the connection is released (browser/RN per-origin limits).

## Goals

- **Client (`@enkaku/client`), all transports:** an aborted or timed-out request/stream/channel call
  rejects immediately with the abort reason, even while `sent` is pending. Covers `call.abort()`,
  `config.signal`, and `timeout`. A `sent` rejection after abort is absorbed (no unhandled rejection).
  A late response for an aborted rid is dropped (existing behaviour once the controller is removed).
- **http-fetch (`@enkaku/http-fetch`), opt-in:** `ClientTransportParams.cancelOnAbort?: boolean`,
  default `false`. When true, an outgoing `abort` message for a rid cancels that rid's in-flight
  request POST, then the abort POST is sent as today.

## Non-goals

- No change to `@enkaku/transport` (`Transport.write` signature unchanged).
- No change to other transports.
- Runtime polyfills (`AbortSignal.any`, `Symbol.asyncDispose`): handled in `@sozai/runtime-expo`.

## Anti-goals

- A per-request cancel must never error or close the whole transport.
- A per-request cancel must never touch the shared SSE session.
- No breaking change; patch releases for `@enkaku/client` and `@enkaku/http-fetch`.

## Approaches

- **A. Optional signal on `Transport.write(value, { signal })`.** General contract, but public API change
  in `@enkaku/transport`, ignored by every transport but http-fetch, threading through `#write`/`safeWrite`.
- **B. http-fetch cancels on seeing the outgoing `abort` message (chosen).** `rid → AbortController` map
  for in-flight POSTs; every abort path already ends in `#notifyAbort`. No interface change; the
  transport already branches on `typ`/`rid` (`sendSerial`, synthetic error replies).
- **C. Optional `cancel(rid)` capability on transports.** New surface plus feature detection, no gain over A/B.

Picked B, made opt-in via `cancelOnAbort` (default `false`). The client fix and the transport fix are
independent and ship together on branch `fix/request-abort-before-sent`.

## Decided shape

- **Client:** `createRequest` builds the call promise from `controller.result`, not
  `sent.then(() => controller.result)`; `sent` rejection is forwarded into the controller (abort/error
  if not already settled) and otherwise absorbed. `abort()` calls `controller.abort` directly instead
  of deferring to `sent`. Apply to request, stream and channel (stream/channel use `createRequest`).
- **http-fetch:**
  - Track an `AbortController` per in-flight request POST keyed by rid (only when `cancelOnAbort`);
    the fetch gets `AbortSignal.any([transportSignal, perRequestSignal])`. Remove the entry when the
    POST settles.
  - On an outgoing `abort` message with `cancelOnAbort`, abort the rid's controller before sending.
  - A fetch rejected by the per-request signal is not a transport failure: it must not reach
    `controller.error(...)` in `send()`; the send resolves/rejects for that message alone.
  - The SSE connect (first stream/channel open) never gets a per-rid signal. Later stream/channel opens
    over `sendClientMessage` may; ordering through `sendSerial` is unchanged.

## Tests

- Never-responding handler + `call.abort()`: call rejects within a tick; with `cancelOnAbort`, the
  fetch's `signal.aborted` is true. Without it, fetch signal not aborted (default unchanged).
- Same with `config.signal` and `timeout`.
- Four withheld requests aborted, then a fifth succeeds.
- Per-request cancel leaves the transport usable (later requests succeed; readable not errored).
- Stream/channel message ordering via `sendSerial` unchanged; SSE session survives a stream abort.

## Left to the builder

- Exact test harness (mock fetch vs. http-serve integration), naming of internals.
- README note for `cancelOnAbort` and the RN/Expo polyfill import (`@sozai/runtime-expo/polyfill`).
- Release intent files per `kigu:releasing` (patch for both packages).
