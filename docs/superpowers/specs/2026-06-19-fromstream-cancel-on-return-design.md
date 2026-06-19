# `fromStream` cancel-on-return — Design

**Date:** 2026-06-19
**Status:** approved, ready for implementation plan
**Origin:** backlog item `docs/agents/plans/backlog/fromstream-cancel-on-return.md`; surfaced by mokei `fix/session-lifecycle`.

## Problem

`packages/generator/src/index.ts:140-153`:

```ts
export async function* fromStream<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  } finally {
    reader.releaseLock() // only releases the lock; never cancels the source
  }
}
```

When a consumer breaks out of (or `.return()`s) the generator early, the `finally`
runs `reader.releaseLock()` only. The underlying `ReadableStream` is **not**
cancelled, so its `cancel()` callback never fires — any resource the source holds
(HTTP connection, child-process pipe, timer) stays open until GC.

This diverges from the native `ReadableStream` async iterator
(`stream[Symbol.asyncIterator]()`), which on early `return()` calls
`reader.cancel()` unless created with `{ preventCancel: true }`. A drop-in
generator wrapper that does the opposite is a footgun. mokei hit this in
`Session#streamChatTurn` and worked around it by abandoning `fromStream` for a
hand-rolled `reader.read()` loop whose `finally` calls `reader.cancel()`
(mokei `packages/session/src/session.ts`, commit `b2516c8`).

## Decision: cancel by default

Cancel the source on early return; expose `preventCancel` as the opt-out. This
matches native async-iterator semantics.

Safe because there are **no production consumers in enkaku** — `fromStream` is
used only by two tests in `packages/generator/test/lib.test.ts`, and neither
re-reads the stream after partial consumption. Nothing relies on the old
break-without-cancel behavior. `preventCancel` exists for any future consumer
that intentionally wants release-without-cancel.

## Change

`packages/generator/src/index.ts`:

```ts
export async function* fromStream<T>(
  stream: ReadableStream<T>,
  options: { preventCancel?: boolean } = {},
): AsyncGenerator<T> {
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      yield value
    }
  } finally {
    if (!options.preventCancel) {
      // Early return / break / throw: cancel the source so its cancel()
      // callback runs and resources are released. cancel() on an
      // already-closed stream is a no-op, so normal completion is unaffected.
      await reader.cancel().catch(() => {})
    }
    reader.releaseLock()
  }
}
```

Notes:
- Normal completion (`done === true`): the stream is already closed, so
  `reader.cancel()` resolves immediately as a no-op. No truncation, no behavior
  change, all values still yielded.
- `await reader.cancel()` before `releaseLock()` is the correct order — the
  locked reader is what owns the cancel.
- `.catch(() => {})` swallows cancel rejections so cleanup never masks the
  reason the generator is unwinding (an upstream throw or consumer return).

## Tests

`packages/generator/test/lib.test.ts`, `describe('fromStream()')`:

- **Existing** normal-consumption test (~line 390): unchanged, must still pass —
  all values yielded.
- **Existing** `.return(null)` lock-release test (~line 403): must still pass —
  `releaseLock()` still runs, `readable.locked === false`.
- **Add** — early return cancels source: build the stream with
  `new ReadableStream({ start... , cancel() { cancelled = true } })`, consume one
  value, break/`.return()`, assert `cancelled === true`.
- **Add** — normal completion does not trigger cancel side effects: source
  closes naturally, `cancel` callback either not invoked or no-op, all values
  received.
- **Add** — `preventCancel: true` on early return does NOT call the source
  `cancel()` callback (lock still released).

## Docs

API reference under `website/docs/api/generator` is generated — regenerate via
the normal build, do not hand-edit.

## Out of scope

- Changing mokei's hand-rolled workaround. Once this ships, mokei can revert to
  `fromStream` in a separate follow-up; not part of this change.
- Any change to `consume` or `fromEmitter` in the same module.
