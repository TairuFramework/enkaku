# `@enkaku/socket` connect timeout and socket release on dispose — complete

**Date:** 2026-07-12
**Status:** complete
**Branch:** `socket-connect-and-dispose-lifecycle`
**Origin:** two gaps found downstream while hardening `@tejika/process`'s daemon lifecycle, filed as a `next/` backlog item consumed by this work. Follows on from `completed/2026-07-11-transport-lifecycle-hardening.complete.md`, which touched the same seam.

## Goal

Close both ends of the socket lifecycle in `packages/socket/src/index.ts`:

1. **`connectSocket` could not be bounded, and leaked its listeners.** `createConnection` against a socket path that exists but has nothing accepting hangs indefinitely, with no `timeoutMs` or `signal` to stop it. Both listeners were `on`, not `once`, and neither was removed on settle — the `error` listener stayed attached for the socket's whole life, calling `reject` on an already-settled promise.
2. **`SocketTransport` dispose only `unref()`d, and skipped function sources.** `unref()` is not a release: the socket stays *open* and the peer's server still sees a live connection. A `typeof source !== 'function'` guard meant a lazily-connecting or reconnecting transport never registered the hook at all.

Both forced local mitigations in tejika: a `connectWithTimeout` racing `connectSocket` against a timer, and manual `transport.dispose().then(() => socket.destroy())` bookkeeping. Both are now deletable.

## What was built

**`connectSocket(path, options?)`** takes `{ timeoutMs, signal }`. Default 10s; `timeoutMs: 0` disables it. `once` listeners for `connect` and `error`, with a `cleanup()` that detaches both plus the abort listener and clears the (`unref`'d) timer on every settle path — a settled promise leaves zero listeners on the socket. Either abandon path (timeout or abort) `destroy()`s the pending socket, so there is no late socket to leak.

**The writable's close callback flushes before releasing.** It is now async and awaits `socket.end()`'s flush, bounded by `END_GRACE_MS` (2s, a module constant — no option exposed until something needs one), then `unref()`s. `writer.close()` therefore resolves only once buffered writes have actually reached the wire; before, it resolved with bytes still queued, so a `destroy()` on dispose could drop a message written just before it.

**`waitForDrain` takes the transport's signal and bounds the wait.** On abort it does *not* reject immediately — it starts an `END_GRACE_MS` countdown while still listening for `drain`/`close`/`error`. A peer that recovers inside the grace drains normally; a peer that never reads again rejects after ~2s.

**`SocketTransport` releases the socket on dispose, for every source shape.** The `disposed` hook is registered unconditionally and `destroy()`s. The socket promise is memoized (eagerly primed for non-function sources, so a transport handed a `Socket` and never used still releases it); a function source that was never invoked opens nothing, and dispose does not connect one just to destroy it. A `string` path is now wrapped in a lazy `() => connectSocket(socket, { timeoutMs: connectTimeoutMs, signal })`, with a new `connectTimeoutMs` param.

**`Transport.dispose()` (in `@enkaku/transport`)** now takes its writer *inside* the `try`, so a rejected stream still emits `disposed`.

Changeset: `@enkaku/socket` minor, `@enkaku/transport` patch.

## Key design decisions

**A 10s default connect timeout, not opt-in.** Every connect is bounded unless the caller passes `timeoutMs: 0`. The alternative — unbounded by default, timeout opt-in — preserves the hang for exactly the callers least likely to have thought about it.

**Release is flush-then-destroy, split across two owners.** `Transport.dispose()` closes the writer (flushing and `end()`ing the socket) *before* emitting `disposed`, and the `disposed` hook `destroy()`s. So `destroy()` is strictly last and `ERR_STREAM_DESTROYED` from `end()`ing an already-destroyed socket is unreachable by construction, not merely absorbed by an error listener. The writable's `unref()` stays: `createTransportStream` is exported and used bare, without a `Transport` on top, and such a caller has no `disposed` hook.

**On abort, `waitForDrain` grants a grace rather than rejecting.** This is the branch's sharpest lesson. Rejecting instantly *does* bound the hang — but it errors the write sink, which errors the `WritableStream`, which makes `writer.close()` reject **without ever running its close callback**, skipping the flush entirely. A stalled-then-recovering peer then lost 98% of its payload (73,728 of 4,194,325 bytes) while seeing a graceful FIN, so it could not even tell it had been cut off. The grace makes both properties hold together: dead peer bounded at ~2s, recovering peer fully flushed. The bound is per-parked-write, not global — a peer that stalls, drains one write, then re-stalls gets a fresh grace — but every extra grace is paid for by a write actually draining, so progress is guaranteed.

**The stream thunk calls `this.signal.throwIfAborted()`.** Lazy connect introduced a leak: a `read()` after disposing an unused transport would run the thunk and open a *fresh* live socket that the already-fired `disposed` hook would never destroy. `Transport` extends `Disposer` extends `AbortController` and `dispose()` aborts synchronously before its callback runs, so the guard fires first. It does not break the normal dispose path — `dispose()` only takes a writer when a stream already exists, and `_getStream()` then returns the memoized one without re-invoking the thunk.

**Lazy connect for a `string` path was kept, knowingly.** It is *not* required by the dispose fix, and it is an independently-scoped behaviour change: connect errors and latency now surface at first read/write rather than in the constructor. Kept because a transport that is constructed and never used should not open a socket, and because the params' `signal` now also cancels a pending connect. Invisible to `Client` (which reads in its constructor); the deadlock the test suite hit twice was test-mechanics — a test awaiting the peer's `connection` event before its own first I/O hangs, since nothing triggers the connect.

## Review outcome

The final whole-branch review found the branch's headline guarantee was defeated by base code it had not touched: a write larger than the socket buffer to a peer that stops reading parked in `waitForDrain` forever, and since `WritableStream` queues its close request *behind* in-flight writes, `Transport.dispose()` never returned, `disposed` never fired, `destroy()` never ran. The advertised 2s bound was never even armed. It also found that `await this._getWriter()` sitting outside the `try` in `Transport.dispose()` meant a rejected stream (a failed connect, or the new 10s timeout) skipped `disposed` entirely — while this branch had just made `disposed` the sole owner of socket release.

The **first fix for that regressed the flush** (the instant-reject described above) and the confirmation pass caught it. Worth noting *why no test saw it*: the flush test uses a 10,000-byte payload, deliberately small enough that `socket.write()` returns `true`, so it never enters `waitForDrain` at all; the dead-peer test stays bounded under the bug. Only a purpose-built stalled-then-recovering-peer test discriminates.

Two other traps, both worth remembering:

- **A "simpler" regression test would have been a trap.** Construct-a-transport-and-dispose-it-unused looks like the faithful minimal test, but reverting *only* `destroy()` → `unref()` while keeping lazy connect makes it go **green** — it passes because a never-used transport now opens no socket, not because dispose destroys. The integration test (draining server + 5 MiB unconsumed write-back) is the only test in the repo guarding `destroy()` vs `unref()`.
- **The plan's own integration test was always-red**, not vacuous: a server that never `resume()`s never sees its connection close, fix or no fix. Running it four ways surfaced the real story — pre-fix, the close callback *already* called `socket.end()`, which sends FIN, and a default server socket (`allowHalfOpen: false`) then closes. So a draining peer with a *used* transport already closed in milliseconds. `unref()` was not the whole story, and the changeset's original "would wait forever" claim was corrected: the hang needs either a transport that was never read from or written to (so `end()` never ran) or a peer with data queued to a client that never reads.

Across the branch, three test-quality bugs of my own were caught by review and one implementer-caught vacuity — the same tax the preceding branch paid seven times over. Every test here was mutation-proven: stash the fix, watch it red on a concrete value, restore, watch it green.

## Follow-on

- `next/2026-07-12-transport-signal-not-forwarded-to-disposer.md` — `Transport`'s constructor never forwards `params.signal` to `Disposer`, so `new SocketTransport({ socket, signal })` + `controller.abort()` does **not** dispose the transport and does not destroy the socket. Pre-existing, confirmed empirically, and this branch makes the gap sharper by putting socket release on the `disposed` event.
- `next/2026-07-12-bare-transport-stream-has-no-release-path.md` — a bare `createTransportStream` consumer (mokei's `host-monitor`) has no `disposed` hook, so a stalled peer leaves a half-open socket forever. Pre-existing; the branch bounded the wait in front of it but did not change the outcome.

## Out of scope

- Any transport other than `socket`. `node-streams`, `message-port` and the HTTP transports have their own release stories, untouched here.
- Making `END_GRACE_MS` configurable.
- Reconnect-with-backoff in the transport itself: `_getStream()` memoizes, so a function source runs at most once per transport instance. Reconnection means a new transport per attempt, which is what tejika already does.
