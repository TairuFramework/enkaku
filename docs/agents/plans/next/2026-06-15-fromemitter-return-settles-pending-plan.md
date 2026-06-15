# `fromEmitter` parked-next settle fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `fromEmitter`'s `return()`/`throw()`/dispose/abort settle an outstanding parked `next()` with `{done:true}` instead of hanging forever, and stop dropping falsy event values.

**Architecture:** Reshape the internal `pending` deferred to carry an `IteratorResult`, settle it from the single `stop()` choke point that all close paths already call, and switch `next()`'s empty-queue check from a `value != null` guard to a `queue.length` check.

**Tech Stack:** TypeScript, Vitest, `@enkaku/async` (`defer`/`Deferred`), `@enkaku/event` (`EventEmitter`).

**Design spec:** `docs/agents/plans/next/2026-06-15-fromemitter-return-settles-pending-design.md`

---

## File Structure

- Modify: `packages/generator/src/index.ts:69-131` — the `fromEmitter` function only. No other export changes.
- Modify: `packages/generator/test/lib.test.ts` — add a `raceTimeout` helper and new tests inside the existing `describe('fromEmitter()')` block.

No new files. No public API change.

---

## Task 1: Add tests for the parked-next settle behavior (red)

**Files:**
- Test: `packages/generator/test/lib.test.ts`

These tests exercise the parked path: call `next()` while the queue is empty (no event emitted), THEN close the iterator. Today these hang; `raceTimeout` turns a hang into a fast failure.

- [ ] **Step 1: Add the `raceTimeout` helper**

At the top of `packages/generator/test/lib.test.ts`, after the existing imports, add:

```ts
// Rejects if `promise` does not settle within `ms`, so a regression that
// leaves next() parked forever fails fast instead of hanging the suite.
function raceTimeout<T>(promise: Promise<T>, ms = 200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ])
}
```

- [ ] **Step 2: Add the new tests inside `describe('fromEmitter()')`**

Append these tests inside the existing `describe('fromEmitter()', () => { ... })` block (after the `throw()` test, before the closing `})`):

```ts
test('settles a parked next() with {done:true} on return()', async () => {
  const emitter = new EventEmitter<{ test: number }>()
  const generator = fromEmitter(emitter, 'test')

  // Queue empty: this next() parks on `pending`.
  const parked = generator.next()
  generator.return()

  expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
})

test('settles a parked next() with {done:true} on throw()', async () => {
  const emitter = new EventEmitter<{ test: number }>()
  const generator = fromEmitter(emitter, 'test')

  const parked = generator.next()
  // throw()'s own promise rejects with the reason...
  await expect(generator.throw('boom')).rejects.toBe('boom')
  // ...but the parked next() resolves cleanly.
  expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
})

test('settles a parked next() with {done:true} on dispose', async () => {
  const emitter = new EventEmitter<{ test: number }>()
  const generator = fromEmitter(emitter, 'test')

  const parked = generator.next()
  await generator[Symbol.asyncDispose]()

  expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
})

test('settles a parked next() with {done:true} on signal abort', async () => {
  const controller = new AbortController()
  const emitter = new EventEmitter<{ test: number }>()
  const generator = fromEmitter(emitter, 'test', { signal: controller.signal })

  const parked = generator.next()
  controller.abort()

  expect(await raceTimeout(parked)).toEqual({ done: true, value: undefined })
})

test('a raw for await cancelled mid-park terminates cleanly', async () => {
  const emitter = new EventEmitter<{ test: number }>()
  const generator = fromEmitter(emitter, 'test')

  const loop = (async () => {
    // No event is ever emitted; the loop parks immediately then is cancelled.
    for await (const _ of generator) {
      // unreachable
    }
  })()

  // Let the loop reach its parked next(), then cancel via the iterator.
  await new Promise((resolve) => setImmediate(resolve))
  await generator.return()

  await expect(raceTimeout(loop)).resolves.toBeUndefined()
})

test('delivers falsy event values instead of dropping them', async () => {
  const emitter = new EventEmitter<{ test: number | null | undefined }>()
  const generator = fromEmitter(emitter, 'test')

  // Park first, then emit a falsy value: the listener resolves the parked next().
  const parked = generator.next()
  emitter.emit('test', 0)
  expect(await raceTimeout(parked)).toEqual({ value: 0, done: false })

  const parkedNull = generator.next()
  emitter.emit('test', null)
  expect(await raceTimeout(parkedNull)).toEqual({ value: null, done: false })
})
```

- [ ] **Step 3: Run the new tests — verify they FAIL (hang → timeout)**

Run: `pnpm --filter @enkaku/generator run test:unit -- -t fromEmitter`
Expected: FAIL — the new `return()`/`throw()`/dispose/abort tests reject with `timed out after 200ms` (the parked promise never settles today). The falsy test fails because `0`/`null` are dropped and re-park (also a timeout). The pre-existing `fromEmitter` tests still pass.

- [ ] **Step 4: Commit the red tests**

```bash
git add packages/generator/test/lib.test.ts
git commit -m "test: parked next() must settle on close for fromEmitter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Implement the settle + length-check fix (green)

**Files:**
- Modify: `packages/generator/src/index.ts:69-131`

- [ ] **Step 1: Replace the `fromEmitter` body**

Replace the entire `fromEmitter` function (lines 69-131) with:

```ts
export function fromEmitter<
  Events extends Record<string, unknown>,
  EventName extends keyof Events & string = keyof Events & string,
>(
  emitter: EventEmitter<Events>,
  name: EventName,
  options?: { filter?: (event: Events[EventName]) => boolean; signal?: AbortSignal },
): AsyncGenerator<Events[EventName], void, void> {
  let isDone = false
  let pending: Deferred<IteratorResult<Events[EventName], void>> | null = null
  const queue: Array<Events[EventName]> = []

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

  const stop = () => {
    unsubscribe()
    isDone = true
    if (pending != null) {
      pending.resolve({ done: true, value: undefined })
      pending = null
    }
  }

  options?.signal?.addEventListener('abort', () => {
    stop()
  })

  return {
    [Symbol.asyncDispose]() {
      stop()
      return Promise.resolve()
    },
    [Symbol.asyncIterator]() {
      return this
    },
    next: () => {
      if (isDone) {
        return Promise.resolve({ done: true, value: undefined })
      }
      if (queue.length > 0) {
        return Promise.resolve({ value: queue.shift() as Events[EventName], done: false })
      }
      pending = defer<IteratorResult<Events[EventName], void>>()
      return pending.promise
    },
    return: () => {
      stop()
      return Promise.resolve({ done: true, value: undefined })
    },
    throw: (reason: unknown) => {
      stop()
      return Promise.reject(reason)
    },
  }
}
```

Key changes vs. the original:
- `pending` type is now `Deferred<IteratorResult<Events[EventName], void>> | null`.
- Listener resolves `{ value: event, done: false }` (was a bare `event`).
- `stop()` resolves any outstanding `pending` with `{ done: true, value: undefined }` and nulls it.
- `next()` checks `queue.length > 0` (was `value != null`) and returns `pending.promise` directly (the old trailing `.then((value) => ({ value, done: false }))` mapping is gone).

- [ ] **Step 2: Run the new tests — verify they PASS**

Run: `pnpm --filter @enkaku/generator run test:unit -- -t fromEmitter`
Expected: PASS — all parked-settle tests resolve `{done:true}` well under 200ms; the falsy test delivers `0` and `null`.

- [ ] **Step 3: Run the full generator suite — verify no regressions**

Run: `pnpm --filter @enkaku/generator run test:unit`
Expected: PASS — all existing `consume()`, `fromEmitter()`, and `fromStream()` tests still green.

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @enkaku/generator run test:types`
Expected: PASS — no type errors (`Deferred<IteratorResult<...>>` resolves cleanly; `queue.shift() as Events[EventName]` is the only assertion).

- [ ] **Step 5: Commit the fix**

```bash
git add packages/generator/src/index.ts
git commit -m "fix: settle parked fromEmitter next() on close, deliver falsy events

return()/throw()/dispose/abort now resolve an outstanding parked next()
with {done:true} via the shared stop() path, so raw async-iterable
consumers terminate instead of hanging. next() uses a queue.length check
so emitted null/undefined/0 events are delivered, not dropped.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Lint and final verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `rtk proxy pnpm run lint`
Expected: PASS — no format/lint errors. (Project convention: use `rtk proxy`, not bare `pnpm run lint`.)

- [ ] **Step 2: Full package test (types + unit)**

Run: `pnpm --filter @enkaku/generator run test`
Expected: PASS — types and unit tests both green.

- [ ] **Step 3: Commit any lint-applied formatting (only if lint changed files)**

```bash
git add -A
git commit -m "chore: lint fromEmitter changes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

If lint changed nothing, skip this step.

---

## Self-Review notes (verification of this plan against the spec)

- **Spec §Design 1 (reshape `pending`)** → Task 2 Step 1.
- **Spec §Design 2 (listener resolves full result)** → Task 2 Step 1.
- **Spec §Design 3 (`stop()` single settle point)** → Task 2 Step 1; throw() rejects own promise, parked resolves `{done:true}` → Task 1 throw test.
- **Spec §Design 4 (`queue.length` check)** → Task 2 Step 1; falsy delivery → Task 1 falsy test.
- **Spec §Testing (all six cases + timeout-race)** → Task 1 (`raceTimeout` + five settle/cancel tests + falsy test).
- **Spec §Done when** → covered by Task 1 tests + Task 2 Step 3 regression run + Task 3.
- **No public API change** → only `fromEmitter` internals touched; signature unchanged.

## Follow-up (out of scope, not in this plan)

Kubun's Phase 6 manual-iterator wrapper (`packages/plugin-connector/src/schema.ts` `subscribeToConnectorSyncEvents`) can later be simplified back to plain delegation. Not blocked on this change; tracked separately.
