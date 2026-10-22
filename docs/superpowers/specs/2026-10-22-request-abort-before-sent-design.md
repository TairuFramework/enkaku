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
  Pre-aborted `config.signal` calls (`client.ts:700`, `:797`, `:894`) keep their current rejection
  value (the signal object) to stay non-breaking; their `sent` rejection must still settle
  `controller.result`. Forward the rejection value unchanged with `controller.error(value)`: neither
  `controller.abort()` (no listener on that path) nor `controller.aborted(signal)` (rejects with
  `signal.reason`, a value change) will do.
- **Caller-supplied rid reuse:** the wire protocol carries only the rid, so an old call's late response
  or delayed `abort` cannot be told apart from a replacement call's. Early settlement widens that
  window. Constraint, documented on `config.id`: do not reuse the id of an aborted call while its
  request may still be in flight. Map cleanup stays identity-checked (`=== controller`) in both client
  and http-fetch, so the old call never deletes the replacement's entry.
- **http-fetch (`@enkaku/http-fetch`), opt-in:** `ClientTransportParams.cancelOnAbort?: boolean`,
  default `false`. When true, an outgoing `abort` message for a rid cancels that rid's in-flight
  request POST, then the abort POST is sent as today.

## Non-goals

- No change to `@enkaku/transport` (`Transport.write` signature unchanged).
- No change to other transports.
- Runtime polyfills (`AbortSignal.any`, `Symbol.asyncDispose`): handled in `@sozai/runtime-expo`.

## Anti-goals

- A per-request cancel (the cancelled POST and its body read) must never error or close the whole
  transport. The same holds for the best-effort abort POST itself, which fails the transport today
  (fix below).
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
- **Client, abort before the write reaches the transport:** `#createMessage` is async, so an abort can
  overtake its own request. `#write` skips `transport.write` for a non-`abort` payload whose owning
  controller has already settled, so an aborted request is never POSTed late. The `abort` message is
  still sent; the server ignores an unknown rid.
- **Client dispose:** `#abortControllers` triggers `#notifyAbort`, whose `#write` preflight throws (client
  signal already aborted), so no `abort` message reaches the transport. Fetches must be cancelled by
  `transport.dispose()` aborting the transport-wide signal, but today ordinary POSTs get no signal
  (`sendClientMessage` → `sendMessage(msg, headers)`, `http-fetch/src/index.ts:258`). Fix: every POST
  gets the transport signal, whatever `cancelOnAbort` is set to. Test both values.
- **http-fetch:**
  - Track an `AbortController` per in-flight request POST keyed by rid (only when `cancelOnAbort`);
    the fetch gets `AbortSignal.any([transportSignal, perRequestSignal])`. Remove the entry only once
    the response body has been consumed (`res.json()` runs after `sendClientMessage` returns), not when
    the headers arrive.
  - A body read rejected by the per-request signal is absorbed (the rid is already aborted). It must
    not reach `controller.error(new Error('Failed to parse response'))`.
  - On an outgoing `abort` message with `cancelOnAbort`, abort the rid's controller at `sendSerial`
    entry, before the abort is queued behind a pending stream/channel open in `ridChains`.
  - Cancellation must also cover work that has not reached `fetch` yet: a stream/channel open waiting
    in `getSessionID()` (`index.ts:325`) for the SSE connect, or queued in `ridChains`. Record the
    per-rid cancel state at `sendSerial` entry, before any wait. Queued or waiting work checks it
    before starting its POST and skips the POST when cancelled (it resolves; the client side has already
    settled). Clear the state once that rid's chain drains.
  - **Abort POST failure isolation (existing bug, fixed whatever `cancelOnAbort` is set to):** a failed
    `abort` message must not error the shared readable. Today a fetch rejection reaches
    `controller.error(new Error('Transport write failed'))` in `send()` (`index.ts:337`), and an
    unparsable response body reaches `controller.error(new Error('Failed to parse response'))`
    (`index.ts:295`). Both tear down the client (`client.ts:436`) and every active call, SSE streams
    included. For `typ: 'abort'`, `send()` rejects that message alone (no `controller.error`), and a
    body or parse failure is absorbed. The client side already handles that rejection: `safeWrite`
    emits `writeFailed`, and `onFailure` is a no-op because the owner has already settled.
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
- Abort after headers but during body read: transport not errored.
- Abort of a stream whose open is still queued: cancellation is not delayed behind the open.
- Abort before `#createMessage` resolves: the request is never written to the transport.
- Client dispose with withheld requests: in-flight fetches end up aborted, with `cancelOnAbort` both
  `true` and `false`.
- Second stream open aborted while it waits for the SSE connect: once SSE connects, its POST never starts.
- Pre-aborted `config.signal` for request/stream/channel: the call rejects (same value as today) and
  `controller.result` settles.
- Abort POST fails (fetch rejects; bad JSON body) while another request and an SSE stream are active:
  the transport stays up and both keep working; `writeFailed` is emitted.
- Reused rid: a late response or delayed abort from the old call does not delete the replacement's map
  entry (identity-checked cleanup).

## Left to the builder

- Exact test harness (mock fetch vs. http-serve integration), naming of internals.
- README note for `cancelOnAbort` and the RN/Expo polyfill import (`@sozai/runtime-expo/polyfill`).
- Release intent files per `kigu:releasing` (patch for both packages).
