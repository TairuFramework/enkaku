# `fromEmitter` return()/throw()/dispose must settle a parked next() — complete

**Status:** complete
**Date:** 2026-06-15
**Package:** `@enkaku/generator` (`packages/generator/src/index.ts`)
**Origin:** surfaced by kubun subscription-lifecycle work (Phase 6); sibling of the `consume()` teardown fix (`2026-06-11-kubun-audit-boundary-fixes.complete.md` §1).

## Goal

Stop `fromEmitter`'s hand-rolled async iterator from hanging a parked `next()` forever when the iterator is closed, so raw async-iterable consumers (`for await`, manual pull loops) terminate cleanly. Same defect class as kubun's graphql `createEventGenerator`.

## What was built

- **Settle on close.** `pending` reshaped from `Deferred<Events[EventName]>` to `Deferred<IteratorResult<Events[EventName], void>>`. The single `stop()` choke point — called by `return()`, `throw()`, `[Symbol.asyncDispose]`, and signal-abort — now resolves any outstanding `pending` with `{done:true, value:undefined}` and nulls it, alongside the existing unsubscribe + `isDone = true`.
- **Falsy events delivered.** `next()`'s empty-queue guard changed from `value != null` to `queue.length > 0`, so queued `null`/`undefined` events are delivered instead of dropped and re-parked. (`0` was never affected — `0 != null` is true.)
- **Pre-aborted signal guard** (added in review). A signal already aborted at construction never fires `'abort'`, so the listener would never run and a later `next()` would park forever. Now guarded with `if (options?.signal?.aborted) stop()`, mirroring `consume()`'s already-aborted handling.

## Key design decisions

- **`throw()` semantics:** the parked `next()` resolves `{done:true}` (matching `return()` teardown, least-surprising for `for await`), while `throw()`'s own returned promise still rejects with the thrown reason. A separately-thrown in-flight reason is unusual; teardown for the parked consumer is the sane default.
- **Centralize in `stop()`** rather than per-method settle: all four close paths already funnel through it. Idempotent — second `stop()` finds `pending == null`; `@enkaku/event` `off` and native `Promise.resolve` are both no-ops on repeat.
- **No public API change.** Only `fromEmitter` internals touched; `consume` and `fromStream` untouched.

## Testing

7 new tests in `packages/generator/test/lib.test.ts` (21 total, all green; types + lint clean):

- Parked `next()` settles `{done:true}` on `return()` / `throw()` / dispose / signal-abort.
- Raw `for await` cancelled mid-park terminates cleanly.
- Queued `null`/`undefined` delivered via the queue-drain path (not dropped).
- `next()` on a generator built from an already-aborted signal returns `{done:true}` (no park).
- `raceTimeout` helper turns any regression hang into a fast 200ms failure instead of hanging the suite (clears its own timer to avoid a leaked handle).

## Process notes

Two defects caught during review and fixed before merge:
1. The first falsy-event test parked-then-emitted, routing through the listener and bypassing the buggy queue-drain guard — corrected to emit-before-`next()`.
2. The pre-aborted-signal case (above), a parked-`next()`-hangs gap the original spec never scoped.

## Follow-up (not blocked on this)

Kubun's Phase 6 manual-iterator wrapper (`packages/plugin-connector/src/schema.ts` `subscribeToConnectorSyncEvents`) can be simplified back toward plain delegation now that the source generator settles its own pending. Tracked separately on the kubun side.
