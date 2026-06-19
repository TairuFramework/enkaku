# `fromStream` cancel-on-return — completed

**Status:** complete
**Date:** 2026-06-19
**Branch:** `fix/fromstream-cancel`

## Goal

Make `@enkaku/generator`'s `fromStream` cancel the underlying `ReadableStream`
on early return, matching native async-iterator semantics, instead of only
releasing the reader lock.

## What was built

`fromStream<T>(stream, options?: { preventCancel?: boolean })`. On early return /
`break` / `.return()` / throw, the generator's `finally` now runs
`await reader.cancel().catch(() => {})` before `reader.releaseLock()`, so the
source's `cancel()` callback fires and its resources (HTTP connection, child
pipe, timer) are released. `preventCancel: true` preserves the old
release-only behavior.

## Key design decisions

- **Cancel by default**, `preventCancel` as opt-out — aligns with native
  `ReadableStream[Symbol.asyncIterator]()`, where early return cancels unless
  `{ preventCancel: true }`. The previous wrapper did the opposite, a footgun.
- **Safe to flip the default**: `fromStream` had zero production consumers in
  enkaku (only two tests), and none re-read a stream after partial consumption,
  so nothing relied on break-without-cancel.
- **No-op on normal completion**: when `done === true` the stream is already
  closed, so `reader.cancel()` resolves immediately — no truncation, all values
  still yielded.
- `.catch(() => {})` on cancel so cleanup never masks an upstream throw or
  consumer-return reason.

## Tests

Three added to `packages/generator/test/lib.test.ts`: early-return cancels the
source; `preventCancel: true` suppresses cancel; normal completion triggers no
cancel side effect. Existing normal-consumption and `.return()` lock-release
tests still pass. Suite: 24/24.

## Follow-on

- mokei can now revert its hand-rolled `reader.read()` workaround
  (`packages/session/src/session.ts`, commit `b2516c8`) back to `fromStream`.
