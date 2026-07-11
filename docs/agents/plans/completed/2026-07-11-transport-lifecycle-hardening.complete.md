# Client / transport lifecycle hardening — complete

**Date:** 2026-07-11
**Status:** complete
**Branch:** `transport-lifecycle-hardening` (PR [#48](https://github.com/TairuFramework/enkaku/pull/48))
**Origin:** the 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`, priorities 2–3), via a `next/` backlog item consumed by this work.

## Goal

Fix nine verified defects clustered around three seams — the client's read loop, the transports' close/backpressure handling, and the server's auth-mode message ordering. Four crashed or hung the process; five degraded correctness or resource safety under load.

Packages: `transport`, `client`, `socket`, `http-serve`, `http-fetch`, `server` (plus a `react` patch for inherited behaviour). All at 0.18.x, pre-1.0.

## What was built

**`@enkaku/client`** — the read loop no longer dies on a malformed server message (`#controllers`/`#spans` are null-prototype maps, so `rid: "__proto__"` cannot resolve to `Object.prototype`; dispatch is additionally guarded). A graceful remote close now disposes the transport, so in-flight requests abort and `handleTransportDisposed` runs instead of hanging forever. `sendEvent()` rejects on a non-teardown write failure. A read loop left stale by a transport swap no longer disposes its own replacement.

**`@enkaku/socket`** — a permanent `'error'` listener plus a sink guard, so a write on a destroyed or ended socket rejects rather than escalating to an uncaught exception. Byte-denominated backpressure via `ByteLengthQueuingStrategy` + `pause()`/`resume()` and an async sink awaiting drain. New `highWaterMark` option (default 1 MiB).

**`@enkaku/http-serve`** — outbound SSE writes refresh `lastAccess` (a passive stream consumer was being cut off at `sessionTimeoutMs`). A duplicate in-flight request ID returns `409` instead of overwriting the first caller's entry. The SSE session buffer is bounded (`maxSessionBufferBytes`, default 1 MiB) and an overflowing session is dropped alone. A disconnected HTTP client aborts its server handler and gets a `499`.

**`@enkaku/http-fetch`** — a non-2xx response to a rid-less event write throws `ResponseError`, rejecting that call alone and leaving the transport usable. Transport writes are explicitly serialized.

**`@enkaku/server`** — handlers abort on the transport's new `requestAborted` event. The auth-mode channel-open/send ordering race is closed by a per-rid barrier. `dispose()` drains in-flight auth before aborting controllers.

**`@enkaku/transport`** — new `requestAborted: { rid: string; reason?: unknown }` event on `TransportEvents`.

## Key design decisions

**Scope: all nine findings in one pass.** Two of the mediums touch the same lines as the highs; splitting meant two passes over the same code. Splitting by package was also rejected — `requestAborted` and the `sendEvent`-rejects change both straddle package boundaries, so the branches would have blocked on each other.

**A failed event write rejects.** `sendEvent` returns `Promise<void>`, which already implies rejection, and callers already `await`. Rid-bearing writes keep resolving because their failure reaches the caller through the aborted controller; rid-less writes have no controller, so the throw is their only channel.

**A slow SSE consumer is dropped, not awaited.** The bridge's writable sink is shared by *every* session, so awaiting one session's `desiredSize` there would head-of-line-block all the others. Instead the SSE body's `ReadableStream` carries a `{ highWaterMark: maxSessionBufferBytes, size: (chunk) => chunk.length }` strategy, which makes `desiredSize` a live byte budget with no manual counter; overflow closes that session alone. `chunk.length` counts UTF-16 code units rather than the bytes the downstream `TextEncoderStream` emits — a deliberate approximation, since the bound is a safety limit, not an accounting guarantee.

**The HTTP-disconnect abort is a transport event, not a synthetic message.** The bridge cannot sign a synthetic `abort` message and `requireAuth` rejects unsigned aborts. A transport-emitted event is trusted precisely *because* it cannot arrive over the wire — `TransportEvents` is an in-process `EventEmitter`, so only a transport implementation can emit it.

**The auth-mode ordering race is closed by a per-rid barrier that is chained, not awaited.** `process()` is synchronous when `requireAuth` is false and async when it is true, and the `channel`/`stream`/`request` cases call it un-awaited — so a `send` arriving right behind its channel open could reach the controller lookup first and be dropped as an unknown channel. A per-rid `pending` map fixes the ordering while preserving cross-rid concurrency (awaiting `process()` outright would serialize every `verifyToken` behind the previous message).

The design originally had `send`/`abort` simply `await pending[rid]`. **Review overturned that**: `handleNext` recurses only after the switch body returns, so an `await` inside a case stalls the *entire* transport read loop — and the promise being awaited runs the user-supplied async `allow` predicate, which is unbounded. Since `http-serve` multiplexes every SSE session over a single server transport, one client's slow access check would have stalled every client. The shipped `deliverInOrder` helper chains the delivery onto the barrier and stores the chain back, so the read loop stays free while per-rid arrival order is preserved. The barrier sits *after* each message's own signature and replay checks — a security property: a forged `send` must never make the server queue work.

## Deviations from the design

- **The `abortController(rid, reason)` helper was not extracted as specced.** The design called for one helper unifying the abort bookkeeping across the timeout sweep, the `abort` message case, and dispose. In implementation the sweep turned out to do its own limiter bookkeeping, and folding it in would have double-released handler slots. The shipped `abortRunningHandler(rid, reason)` therefore does *only* `controller.abort(reason)` + `events.emit('handlerAbort', ...)`, and the timeout sweep is left untouched. `ResourceLimiter.releaseHandler` floor-clamps at zero, which means a double-release is invisible to a single-slot test — the regression guard uses two slots plus a keep-alive handler so that an over-release is actually observable.
- **`ServerEvents['handlerAbort'].reason` widened** from a literal union to `unknown`, since it now also carries transport-defined `requestAborted` reasons. Public type change, declared in the changeset.

## Review outcome

The final whole-branch review found four defects that per-task review structurally could not see — two of them Criticals introduced *by this work*:

- **`http-serve` re-opened its own shared-sink hole.** The bounded-buffer task added a guarded `reportWriteError` helper precisely because a synchronous throw from a user callback inside the shared `writeTo` sink errors the one `WritableStream` every SSE session shares. The disconnect-abort task then added `onRequestAborted?.(...)` *unguarded* on the same sink path. Both callbacks now route through guarded helpers. The tell was an asymmetry invisible task-by-task: the first task wrote an isolation test for `onWriteError` and the `onRequestAborted` mirror was never written.
- **`http-fetch` lost write serialization.** Overriding `ClientTransport.write` to bypass the `WritableStream` is load-bearing (it is what makes one failed event reject only that call), but Web Streams was *also* what serialized sink invocations. Without it, `createChannel()` followed by `channel.send()` fired both POSTs concurrently and the `send` could be dropped server-side as an unknown channel — the same bug the server-side ordering fix was closing, reintroduced at the transport. An explicit send queue restores ordering while keeping the bypass.

Both were reproduced, fixed, and independently re-verified by mutation. Across the plan, **eight tests were caught passing on unfixed code** and tightened before landing — worth treating as a standing tax on test-writing in this codebase.

## Follow-on

`next/2026-07-11-server-dispose-read-window.md` — `Server.dispose()` still admits *newly arriving* messages while draining. This work closed the in-flight case it was scoped to; the arrives-during-dispose case is the same shape one step out, and predates the branch.

## Out of scope

- Backpressure for the `message-port`, `node-streams`, and Electron IPC transports.
- Any transport other than `http-serve` emitting `requestAborted`. The event is declared for all; only `http-serve` emits it today.
- The stale pre-split documentation cleanup (`next/2026-07-07-stale-docs-cleanup.md`).
