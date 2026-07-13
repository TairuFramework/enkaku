# Abort signal and resource release lifecycle

**Date:** 2026-07-13
**Branch:** `abort-signal-and-release-lifecycle`

## Summary

Three pre-existing lifecycle defects, all instances of the same broken promise: *an abort signal should tear a thing down, and tearing it down should release the resource underneath it.* Today none of the three hold end to end.

1. `Transport` accepts `params.signal` and drops it — aborting it disposes nothing.
2. `createTransportStream` releases its socket with `unref()`, which does not close it — a bare consumer leaks the socket.
3. `Server.dispose()` keeps reading and admitting messages while it drains — a handler can start after the abort-all sweep and run on a signal nothing will ever abort.
4. `Server.dispose()` deadlocks when the replay cache throws, stalling every shutdown on that path for the full `cleanupTimeoutMs` (30s by default).

The first three were found by whole-branch reviews (2026-07-11 and 2026-07-12) and left as `next/` items. The fourth was found while verifying that §3's test was not vacuous, and was previously unknown. They are specced together because they are one invariant, and because fixing any one in isolation leaves the chain broken at the next link.

## Background

`Disposer` (`@sozai/async`) is the shared teardown primitive. It extends `AbortController`, exposes `disposed`, and — importantly — already wires an external signal to teardown:

```ts
this.#unsubscribeSignal = onAbort(params.signal, () => this.dispose(params.signal?.reason))
```

So "abort this signal, and the thing disposes" is a capability the base class already provides. The defects below are all cases where a layer either fails to opt into it or fails to finish the job once it fires.

## Design

### 1. `Transport` forwards `params.signal` to `Disposer`

`packages/transport/src/index.ts`. The constructor takes `params.signal`, declares it in `TransportParams`, and calls `super({ dispose })` — without it. `DirectTransports`, in the same file, does forward it (`super({ ...options, dispose })`). The inconsistency is the bug.

Fix: `super({ dispose, signal: params.signal })`.

**Semantics of `signal`:** aborting it is a remote control for `dispose()`. It runs the same graceful path — emit `disposing`, `writer.close()` (which flushes queued bytes), emit `disposed` — not a hard kill. This is what `Disposer` implements, what `DirectTransports` already ships, and the flush is bounded (`END_GRACE_MS` on socket), so "graceful" cannot hang. A caller wanting immediate teardown destroys its own resource.

**Blast radius.** `Transport` is the base class for every transport in the repo. Every subclass already passes `signal` up to `super` — `SocketTransport` (`socket/src/index.ts:311`), `NodeStreamsTransport` (`node-streams/src/index.ts:62`), `MessageTransport` (`message/src/index.ts:71`). They have been passing it into a black hole. So the entire fix lives in `Transport`; no subclass changes.

`SocketTransport` is the one to check for a double-fire, because it uses `signal` for two other things:

- `connectSocket(socket, { signal })` — aborts a *pending connect*, destroying the half-built socket.
- the drain wait uses `this.signal` (the transport's own), not `params.signal`.

After the fix, aborting the external signal both rejects a pending connect *and* disposes the transport. That is correct and not a conflict: the `disposed` hook awaits `socketPromise` inside a `try/catch`, so the rejected connect is swallowed and there is nothing to release. Assert it rather than assume it.

This is a behavior change to a public type's meaning — from "cancels the connect" to "disposes the transport" — even though it is the behavior the type already promised. It gets its own changeset.

### 2. `createTransportStream` destroys its socket on release

`packages/socket/src/index.ts`, the writable's close callback (~line 250). Today:

```ts
socket.end(() => { /* flushed */ })   // half-close, bounded by END_GRACE_MS
socket.unref()                        // does NOT close the socket
```

`unref()` only stops the socket holding the event loop open. It stays open, and the peer's server keeps seeing a live connection. `SocketTransport` gets away with this because its `disposed` hook calls `sock.destroy()`. A consumer using `createTransportStream` **bare** — with no `Transport` on top — has no `disposed` event to hook and so has no release path at all.

That consumer exists: mokei's `host-monitor` does `createTransportStream(connectSocket(socketPath))` and builds its own `Disposer` that closes the HTTP server and the pipes but never touches the socket.

Fix: release the socket — `destroy()`, not `unref()` — at **every terminal exit of the writable sink**.

The sink has three of them, and only one runs the `close` callback. This was verified empirically against the WHATWG streams implementation, because it is the crux of the fix:

| Exit | Sink callback invoked |
|---|---|
| clean close, healthy peer | `close` |
| clean close, stalled peer (the `end()` flush grace expires) | `close` |
| the sink's `write()` **rejects** | **none** |
| explicit `writer.abort(reason)` | `abort` |

When `write()` rejects, the WritableStream errors and neither `close` nor `abort` ever runs — a subsequent `writer.close()` simply rejects with `Invalid state: WritableStream is closed`. That is not a corner case: it is the stalled-peer path. A bare consumer passing a `signal` (a public option on `CreateTransportStreamOptions`) gets exactly this — `waitForDrain` gives up after the grace, rejects the write, and the stream errors with the socket still open and no callback left to release it.

`SocketTransport` survives that path only because `dispose()` catches the rejected `writer.close()` and fires `disposed` regardless, whose hook destroys the socket. A bare consumer has no `disposed` hook, so it has nothing.

So: an idempotent `releaseSocket()` (`socket.destroy()`), called from

- the `close` callback, after the flush settles or its grace expires;
- a new `abort` callback (`writeTo` accepts one — `@sozai/stream` `writable.ts` — and `createTransportStream` does not currently pass it);
- a `catch` around the `write` body, before it rethrows.

Rejected alternative: destroy *only* when the `end()` grace expires. That closes one stalled-peer route but leaves two open — the rejecting-write exit above, and a peer that reads fine yet keeps its own side open, which never triggers the grace at all, so `end()` half-closes, the callback resolves normally, and the socket lingers with a live read side. Release must mean destroy on every exit, not on the unhappy one.

Rejected alternative: return a disposer alongside the stream pair. Honest, but it is a breaking signature change to an exported function, it requires updating mokei, and it is opt-in — a future bare consumer that forgets still leaks. Destroying inside the close callback fixes mokei without touching mokei.

`SocketTransport`'s `disposed` hook stays: it is still the only release path when the stream thunk never ran (transport disposed before any read or write, so no writable, so no close callback). `destroy()` is idempotent, so the two paths overlapping is fine. The observable change for existing `SocketTransport` users is that the socket dies at close-callback time rather than at `disposed`-hook time — marginally earlier, same outcome. The flush still runs first, so nothing is cut off.

### 3. `Server` stops admitting messages once disposal starts

`packages/server/src/server.ts`. `handleNext()` reads, processes, and tail-recurses, and never checks whether disposal has begun. The disposer meanwhile does: drain `pending` (auth in flight) → abort every registered controller → drain `running` → unsubscribe.

So a message *arriving during* the drain is still read, auth-checked, and can register its controller **after** the abort-all sweep. `handleRequest` gives that handler a fresh `AbortController` (`handlers/request.ts:38`) which is registered in `ctx.controllers` but never linked to `ctx.signal` — so once the sweep has passed, nothing aborts it. It runs to completion on a dead signal, after `dispose()` has resolved.

The 2026-07-11 lifecycle-hardening branch closed the "already in flight when `dispose()` was called" case. This is the "arrives while `dispose()` is running" case.

Fix: in `handleNext()`, once a message has been read and disposal has begun, log a warning and return **without recursing**. Do not process it, do not reply.

**Check `disposer.signal`, not the `signal` param.** `handleMessages` reaches `dispose()` by two routes: the server's `#abortController` (arriving via the `signal` param) *and* direct `disposer.dispose()` calls from the transport-read-error, stream-`done`, and replay-cache-failure paths. Only `disposer.signal` is aborted on both — `Disposer.dispose()` calls `this.abort()`. Checking the param would miss the direct routes.

**Placement:** after `await transport.read()` resolves and `next.done` is false, before `processMessage`. A check *before* the read is useless — the read is parked waiting on a peer that may never send — and once we stop recursing the loop is over anyway.

**Why this is sufficient, with the existing `pending` barrier.** Disposal cannot interleave between the check and controller registration:

- non-auth mode: `process` is synchronous, so the controller is registered in the same turn as the check.
- auth mode: `process` is async, and `track()` records it in `pending` — which the disposer awaits *before* the abort-all sweep. A message that passed the check is therefore swept.

**No reply to the client.** A `request`/`stream`/`channel` client whose message lands mid-drain gets no answer and falls back to its own timeout or to the transport disconnect. Considered and rejected: an `ErrorCodes` entry for "server going away". It costs a protocol-visible error code to serve a window that only opens once `dispose()` has started, and a client racing a server shutdown has to handle the disconnect regardless. The warning log gives the *server* operator visibility without adding protocol surface; the client side can be revisited if the dangling read proves to matter in practice.

The whole path is bounded by the existing `cleanupTimeoutMs` race in `Server.dispose`, so it cannot hang shutdown.

### 4. `Server.dispose()` deadlocks when the replay cache throws

Found while checking that §3's test was not vacuous. Pre-existing, previously unknown, and untested — no test covers the replay-cache-failure path at all.

`packages/server/src/server.ts:689`. The auth-mode `process()` is async, so `handleNext` registers it in the `pending` map via `track()` and does **not** await it. When `checkReplay` throws, `process()` does:

```ts
events.emit('transportError', { error })
await disposer.dispose()
return
```

But the disposer's first act is `await Promise.all(Object.values(pending))` — and `pending` contains the very `process()` call now sitting inside `await disposer.dispose()`. `process` waits on `dispose`; `dispose` waits on `process`. Circular.

The graceful path therefore never completes. `Server.dispose()` escapes only through its `cleanupTimeoutMs` race, which then force-disposes the transports — so shutdown burns the **entire timeout, 30 seconds by default**, on every replay-cache failure.

Verified empirically: with the default timeout, `Server.dispose()` had not resolved after 3s; with `cleanupTimeoutMs: 500` it resolved in ~700ms. That is the signature of a graceful path that never completes and a force path that does.

Narrow but real. The in-memory cache never throws, so this needs a custom `ReplayCache` — a Redis-backed one losing its connection is exactly the case, and is exactly the deployment where a 30-second shutdown stall is most expensive.

**Fix:** `void disposer.dispose()` rather than `await`. Nothing follows it but `return`, and `Disposer.dispose()` calls `this.abort()` synchronously, so `disposer.signal` is aborted immediately and §3's bail still sees it on the very next read.

The other four `disposer.dispose()` call sites (lines 725, 729, 790, 894) are in `handleNext`'s direct flow, are never registered in `pending`, and do not deadlock. Only the one inside `process()` does.

This is also what makes §3's second test honest: on this route the disposer is disposed while the read loop keeps running, so it is the *only* route that discriminates between checking `disposer.signal` and checking the `signal` param. Confirmed empirically — a handler for a message arriving after the cache failure runs today.

### 5. Folded in: `http-serve` guarded-callback test gap

`packages/http-serve/src/index.ts`. `reportRequestAborted` is a guarded helper — it swallows a throwing `requestAborted` listener so one bad subscriber cannot take down the server. Only the `dropSession` path has a throwing-callback test. The sweep interval and the SSE listener are guarded by construction (they route through `clearSessionInflight`), but the request-`signal` listener (~line 437) calls `reportRequestAborted` **directly**, untested.

No live defect — the guard works today. But a future edit there could reintroduce a raw unguarded call and nothing would catch it. One mirrored isolation test closes it. Folded in because the branch is already in this territory and the alternative is a `next/` item whose entire content is "write one test".

## Testing

Each fix gets a test that asserts the *property*, not the mechanism.

**Transport signal (`packages/transport`, `packages/socket`):**
- Abort an external signal passed to a `Transport`; expect `disposed` to fire and `transport.signal.aborted` to be true. This is the exact case the reviewer reproduced against the built lib and found broken.
- `SocketTransport` with an external signal: abort, expect `disposed` to fire *and the socket to end up `destroyed`*. The socket assertion is the point — the signal reaching `dispose()` is worthless if the release hook does not then run.
- Abort *during a pending connect*: expect the connect to reject and disposal to still complete cleanly (the double-fire path).

**Socket release (`packages/socket`):** one test per terminal exit of the sink, each asserting `socket.destroyed`.

- Bare `createTransportStream`, close the writable against a **healthy peer**: expect the queued bytes to arrive at the peer *and* the socket to end up `destroyed`. Guards the rejected "only on grace expiry" alternative, which leaves this socket half-open.
- Bare `createTransportStream` **with a `signal`**, against a peer that never reads: abort the signal so `waitForDrain` gives up and the sink's `write()` **rejects**. Expect the socket to be `destroyed`. This is the exit that runs no sink callback at all, so it is the one the original spec would have missed entirely — the highest-value test of the three.
- Bare `createTransportStream`, explicit `writer.abort(reason)`: expect the socket to be `destroyed`. Covers the `abort` callback that is not currently passed to `writeTo`.

A bare consumer with **no** signal against a never-reading peer is deliberately *not* tested: the write parks in `waitForDrain` forever with nothing to abort it, so `close()` is never even reached. That is the pre-existing hang `signal` exists to solve, not a release bug, and it is out of scope here.

**Server drain window (`packages/server`):**
- Start `dispose()`, deliver a message while the drain is in flight, and assert **no new handler ran** — the observable failure today is a handler executing after `dispose()` resolved. Assert the warning was logged.
- The same, on the **replay-cache-failure route**: a `ReplayCache` whose `checkAndRecord` throws on its first call and succeeds afterwards. This is the only route on which the disposer is disposed *while the read loop keeps running*, so it is the only one that discriminates between checking `disposer.signal` and checking the `signal` param — the latter is never aborted here. The cache must succeed on the second call, or message 2 would bail at the replay gate regardless of the fix and the test would prove nothing. Confirmed to fail on unfixed code: the handler runs.
- A transport-read-failure test would be **vacuous** and is deliberately not written: that path `return`s from `handleNext` immediately, so the loop stops and no message is admitted, fix or no fix.

**Server dispose deadlock (`packages/server`):**
- With a throwing replay cache, assert `Server.dispose()` resolves *promptly* — well inside a `cleanupTimeoutMs` set low enough that the force path would be distinguishable. The red signal must be a timeout attributable to the graceful path never completing, not a generic slow test.

**http-serve:**
- Mirror the existing `dropSession` throwing-listener test onto the request-`signal` listener path.

## Out of scope

- **Linking per-handler `AbortController`s to `ctx.signal`.** Considered and dropped as redundant. `handleRequest`, `handleStream`, and `handleChannel` all register their controller in `ctx.controllers`, and the disposer's sweep aborts every entry in that map before awaiting `running` — so in-flight handlers of those three types are already aborted immediately on dispose. The only thing that made the unlinked controller matter was the post-sweep registration window, which §3 closes. Linking them would add a second path to an abort the sweep already performs.

- **Aborting in-flight event handlers.** `handleEvent` is the one handler type that registers no controller and exposes no `signal` on its context. `processHandler` still reserves a limiter slot and tracks it in `running`, so on dispose an in-flight event handler is *awaited but never aborted* — a slow one blocks shutdown until `cleanupTimeoutMs` expires. This is deliberate, not an oversight to fix here: events are fire-and-forget with no reply, "let it finish" is a coherent policy for them, and `cleanupTimeoutMs` bounds the cost. Giving them a signal would mean adding a public field to `EventHandlerContext` — additive but real API surface, and a different change from the three defects this branch fixes. Revisit if a slow event handler ever actually stalls a shutdown.
- An `ErrorCodes` entry for server shutdown (see §3).
- Any change to `mokei`. §2 is deliberately shaped so mokei needs none.

## Changesets

One per package, because they are different stories for a consumer:

- `@enkaku/transport` — `signal` now disposes the transport. Behavior change to a public contract; the one to read before upgrading.
- `@enkaku/socket` — `createTransportStream` now destroys its socket on release. Fixes the bare-consumer leak.
- `@enkaku/server` — no longer admits messages once disposal has started.

`@enkaku/http-serve` gets no changeset: §4 adds a test and changes no behavior.
