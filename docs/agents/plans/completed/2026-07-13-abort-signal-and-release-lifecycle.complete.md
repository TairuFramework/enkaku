# Abort signal and resource release lifecycle

**Status:** complete
**Date:** 2026-07-13
**Branch:** `abort-signal-and-release-lifecycle` → PR #51
**Packages:** `@enkaku/transport`, `@enkaku/socket`, `@enkaku/server` (changesets); `@enkaku/http-serve` (tests only)

## Goal

Enforce one invariant across the RPC layer: **an abort signal should tear a thing down, and tearing it down should release the resource underneath it.**

Six defects, all sharing a single failure shape — *something reports clean teardown while the resource stays alive.* Three were the planned scope, carried from `next/` items filed by earlier branch reviews. The other three surfaced during the work, each exposed by the fix for the one before it.

## What was fixed

**`Transport` dropped `params.signal`.** It was declared on `TransportParams`, taken by the constructor, and never forwarded to `Disposer` — so aborting it disposed nothing. Every transport subclass passes `signal` up to the base class, so all of them were affected. `DirectTransports`, in the same file, had always forwarded it; the inconsistency was the bug.

**`createTransportStream` never released its socket.** It half-closed with `end()` and dropped the event-loop reference with `unref()` — neither of which closes a socket. `SocketTransport` was insulated because its `disposed` hook destroyed the socket; a **bare** consumer (mokei's `host-monitor`) had no such hook and leaked the socket until process exit.

**`Server` admitted messages while `dispose()` drained.** A message arriving mid-drain was still read and auth-checked, and could register its controller *after* the abort-all sweep — leaving a handler running on a signal nothing would ever abort, after `dispose()` had resolved.

**An already-aborted signal silently no-op'd teardown.** `Disposer` invokes the dispose callback synchronously from inside `super()`, before `this` exists in the derived class. The resulting `ReferenceError` is caught, warned, and `disposed` **resolves anyway** — so `dispose()` reported success while nothing was torn down. Affected `Transport`, `DirectTransports`, and `Server`.

**`Server.dispose()` deadlocked when the replay cache threw.** It awaited its own disposer from inside a `pending` entry that the disposer waits on. The graceful path never completed and shutdown was stranded until `cleanupTimeoutMs` (30s) force-disposed.

**That deadlock was accidentally load-bearing.** Fixing it revealed that nothing on the server's self-dispose routes (peer hang-up, read error, replay failure) ever closed the transport — the stall had been the only thing keeping the entry in the active list long enough for the force path to clean it up.

## Key design decisions

**`signal` means "dispose", not "hard kill".** Aborting a transport's `signal` runs the same graceful path as calling `dispose()`: emit `disposing`, flush queued writes, emit `disposed`, release. `Disposer` already implements external-signal wiring, `DirectTransports` already shipped these semantics, and the flush is bounded, so "graceful" cannot hang. A second, harder lifecycle was rejected as unjustified.

**Release means `destroy()`, at *every* terminal exit of the writable sink.** The decisive discovery: when the sink's `write()` **rejects** — which is the stalled-peer path — the WritableStream errors and **neither the `close` nor the `abort` callback ever runs** (a later `writer.close()` just rejects with `Invalid state`). Releasing only in `close`, as originally specced, would have missed the exact case the fix exists for. The socket is now released from the `close` callback (after the flush), a new `abort` callback, and a `catch` around the `write` body. The flush still strictly precedes the destroy, so a clean close never truncates.

**The server's disposal bail checks `disposer.signal`, not the `signal` param.** The async `process()` disposes the disposer directly when the replay cache throws, and on that route the server's `#abortController` — which is what arrives as `signal` — is never aborted at all, while the read loop keeps running. It is the only route that distinguishes the two, and the only one where a message can still be admitted mid-disposal.

**A message dropped mid-drain gets a warning log and no reply.** An `ErrorCodes` entry for "server shutting down" was considered and rejected: it costs protocol-visible surface to serve a window that only opens once `dispose()` has started, and a client racing a shutdown must handle the disconnect regardless.

**Event handlers stay fire-and-forget.** They register no controller and are never aborted on dispose — they have no reply, so "let it finish" is coherent, and `cleanupTimeoutMs` bounds the cost. Making them abortable would mean adding `signal` to `EventHandlerContext`, which is an API addition warranting its own spec. The branch *did* add them to the dispose barrier so an event's in-flight **access check** is now awaited, which is what the disposer's own comment had always claimed.

**Per-handler `AbortController`s are deliberately not linked to `ctx.signal`.** `handleRequest`, `handleStream`, and `handleChannel` all register their controller in `ctx.controllers`, and the disposer's sweep aborts every entry there. Linking would duplicate an abort the sweep already performs. The only window in which a controller escaped the sweep was the read-window bug, which this work closed.

**`Server.dispose()`'s worst case is `2 × cleanupTimeoutMs`, by design.** The graceful race and the force-dispose backstop each get a full budget. Bounded, where it was previously unbounded. Collapsing them onto one shared deadline would leave the backstop zero time to work, defeating it.

## Behavior changes for consumers

- **`@enkaku/transport`** — aborting a `signal` passed to any transport now **disposes it**. Callers relying on it doing nothing must stop passing it.
- **`@enkaku/socket`** — a bare `createTransportStream` consumer that closed `writable` to *half-close* (continuing to drain the peer on `readable`) now has its read side killed too, because release means `destroy()`.
- **`@enkaku/server`** — a message read once disposal has begun is dropped with a warning and no reply.

## Verification

Every fix is mutation-proven: revert it, and its test reds on a concrete assertion. This discipline is enforced because the project has a documented history of tests that pass on unfixed code (eight across the two preceding branches) — and it paid for itself twice here.

It also failed once, instructively. A review-driven fix commit shipped **without** mutation proofs and introduced two Critical bugs — an unbounded `Server.dispose()` hang, and a leaked 30-second timer per disconnect — both of them the branch's own signature failure shape. The whole-branch review caught both and reproduced them on revert. Had the bounded wait been mutation-proven, the author would have been forced to construct a never-settling transport, which surfaces the hang immediately. **A fix commit is a commit: every fix in it gets a test, and every test gets a mutation proof.**

Final state: 48/48 turbo tasks green uncached, lint clean.

## Upstream fix, landed

The already-aborted-signal defect was a property of `Disposer` itself, which lives upstream in `@sozai/async` and is consumed here from the registry (`catalog:`) rather than as a workspace link — so it could not be fixed in this repo. The branch shipped a local patch instead: a microtask yield at the top of the dispose callback in `Transport`, `DirectTransports`, and `Server`, deferring every `this` access until after construction.

`@sozai/async@0.2.1` fixes it in the base class, deferring the signal-triggered `dispose()` by a microtask so the derived constructor always completes first. The catalog moved to `^0.2.1` and all three local yields are gone.

That floor is load-bearing, and mutation-proven: pinned back to `0.2.0` with the yields removed, all three already-aborted-signal tests red (two in `@enkaku/transport`, one in `@enkaku/server`). Do not relax the range.
