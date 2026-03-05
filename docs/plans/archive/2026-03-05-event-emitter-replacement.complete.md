# Replace Emittery with Custom Implementation

**Date:** 2026-03-05
**Status:** Complete

## Summary

Replaced the `emittery` third-party dependency in `@enkaku/event` with a zero-dependency custom implementation using `Map<keyof Events, Set<Listener>>` and `Promise.allSettled`.

## Changes

- Rewrote `packages/event/src/index.ts` to use a `Map+Set` listener registry instead of Emittery
- Removed `{ data }` envelope wrapping/unwrapping that Emittery imposed
- Listeners now execute in parallel via `Promise.allSettled` (previously serial)
- `UnsubscribeFunction` type defined locally instead of re-exported from emittery
- Removed `emittery` from package dependencies and workspace catalog
- Added test coverage for parallel listener execution and multi-error `AggregateError` aggregation

## Impact

- `@enkaku/event` now has zero runtime dependencies
- Public API unchanged -- drop-in replacement for all 4 consumer packages (server, transport, flow, generator)
- All 22 unit tests pass, all 28 workspace test suites pass
