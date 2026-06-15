# Design: `fromEmitter` return()/throw()/dispose must settle a parked next()

**Status:** design (approved for plan)
**Date:** 2026-06-15
**Origin brief:** `docs/agents/plans/next/2026-06-15-fromemitter-return-settles-pending.md`
**Priority:** backlog (no production impact via `consume()`; affects raw async-iterable consumers).

## Problem

`fromEmitter` (`packages/generator/src/index.ts:69-131`) returns a hand-rolled async iterator. When a consumer calls `next()` on an empty queue, the call parks on a fresh `pending` deferred (`:119-120`). `return()` (`:122-125`), `throw()` (`:126-129`), `[Symbol.asyncDispose]` (`:104-107`), and signal-abort (`:99-101`) all funnel through `stop()`, which only unsubscribes and sets `isDone = true` — it never settles the outstanding `pending`. The parked `next()` promise therefore **hangs forever** once the iterator is closed, so any consumer awaiting it (a raw `for await`, or a manual `.next()` pull loop) never terminates.

Same defect class as kubun's graphql `createEventGenerator`, fixed kubun-side in the same effort (`setDone` resolves the outstanding `pending` with `{done:true}` before stopping).

### Adjacent latent bug (in scope)

`next()` guards the empty-queue case with `value != null` after `queue.shift()` (`:115-116`). A legitimately emitted `null` or `undefined` event value is therefore indistinguishable from an empty queue: it gets dropped and the call re-parks. The reshape below switches the guard to a `queue.length` check, which fixes this for free. Kept in scope because the same lines are being rewritten.

## Impact

- **None in production.** Kubun consumes emitter generators through `consume()`, whose own `ended` deferred settles via its abort/done path independent of the source's parked `next()`; `consume()` also calls `iterator.return?.()` fire-and-forget, so the listener is removed. The dangling `pending` is an un-GC'd promise object, not a listener leak.
- **Affects raw consumers.** `for await (const e of fromEmitter(...))` cancelled via the loop's `return()` (or a held iterator's `.return()`) yields a promise that never resolves. Kubun worked around this (Phase 6 manual-iterator wrapper) — the underlying generator should settle its own pending.

## Design

One file changed: `packages/generator/src/index.ts` (plus its test file). No public API change.

### 1. Reshape `pending` to carry an `IteratorResult`

```ts
let pending: Deferred<IteratorResult<Events[EventName], void>> | null = null
```

The deferred now holds the full result and can settle either `{ value, done: false }` (event arrived) or `{ done: true, value: undefined }` (iterator closed while parked).

### 2. Listener resolves with the full result

```ts
const unsubscribe = emitter.on(
  name,
  (event) => {
    if (pending == null) {
      queue.push(event)
    } else {
      pending.resolve({ value: event, done: false })
      pending = null
    }
  },
  { filter: options?.filter },
)
```

### 3. `stop()` is the single settle point

```ts
const stop = () => {
  unsubscribe()
  isDone = true
  if (pending != null) {
    pending.resolve({ done: true, value: undefined })
    pending = null
  }
}
```

All four close paths (`return`, `throw`, `[Symbol.asyncDispose]`, signal-abort) already call `stop()`, so they inherit the settle. Idempotent: a second `stop()` finds `pending == null` and `isDone` already set, so no double-settle and no double-unsubscribe concern beyond what exists today.

`throw(reason)` keeps rejecting **its own** returned promise with `reason` (unchanged); the parked `next()` resolves `{ done: true, value: undefined }`. Decision: parked next settles `{done:true}` rather than rejecting — matches `return()` teardown semantics and is least surprising for `for await` loops. A separately-thrown reason still surfaces to whoever called `throw()`.

### 4. `next()` uses a length check, not a null guard

```ts
next: () => {
  if (isDone) {
    return Promise.resolve({ done: true, value: undefined })
  }
  if (queue.length > 0) {
    return Promise.resolve({ value: queue.shift()!, done: false })
  }
  pending = defer<IteratorResult<Events[EventName], void>>()
  return pending.promise
},
```

`pending.promise` now resolves directly to an `IteratorResult`, so the trailing `.then((value) => ({ value, done: false }))` mapping (`:120`) is removed.

## Error handling

- Parked `next()` after close → resolves `{done:true}` (never rejects).
- `throw()`'s own promise → rejects with `reason`.
- Double close (e.g. `return()` then signal-abort) → second `stop()` is a no-op for `pending`; `unsubscribe()` is already idempotent in `@enkaku/event` usage as exercised today.

## Testing

New tests in `packages/generator/test/lib.test.ts` under `describe('fromEmitter()')`. Existing tests emit values **before** awaiting, so they never park `pending` — these new tests cover the parked path explicitly. Each parked-settle test uses a timeout-race helper so a regression **fails fast** instead of hanging the suite.

- Parked `next()` settles `{done:true}` when `return()` is called.
- Parked `next()` settles `{done:true}` when `throw(reason)` is called (and `throw()`'s promise rejects with `reason`).
- Parked `next()` settles `{done:true}` when `[Symbol.asyncDispose]` runs.
- Parked `next()` settles `{done:true}` when the abort signal fires.
- Raw `for await` over `fromEmitter`, cancelled mid-park (no queued event), terminates cleanly.
- Regression: **queued** `null`/`undefined` event values (emitted before `next()`, so drained via the queue path) are delivered, not dropped/re-parked. Note `0 != null` is true, so `0` was never affected; the bug only hit `null`/`undefined` on the queue-drain path.
- Existing `consume()`-based and `fromEmitter()` tests remain green (listener still removed; no double-settle).

## Done when

- A parked `next()` on a `fromEmitter` iterator settles (`{done:true}`) on `return()`/`throw()`/dispose/abort — verified via timeout-race.
- A raw `for await` over `fromEmitter` terminates cleanly when cancelled.
- Falsy event values are delivered.
- Existing consumers unaffected.

## Notes

- `consume()` already settles correctly on abort/done (`:32-35`, `:50-53`); this is purely the source-generator side. No change there.
- Once landed, kubun's Phase 6 manual-iterator wrapper (`packages/plugin-connector/src/schema.ts` `subscribeToConnectorSyncEvents`) can be simplified back toward plain delegation — not blocked on this, follow-up only.
- Lint via `rtk proxy pnpm run lint` (per project convention).
