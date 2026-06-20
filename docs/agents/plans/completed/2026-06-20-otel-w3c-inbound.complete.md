# `@enkaku/otel` W3C inbound trace-context + baggage activation

**Status:** complete
**Date:** 2026-06-20
**Package:** `@enkaku/otel`
**Origin:** mokei MCP draft-migration G5 inbound (server-side W3C trace propagation) — see `docs/agents/plans/backlog/2026-06-20-mokei-g5-inbound-otel.md`.

## Goal

Let a server consume a client's W3C trace propagation — build an OTel `Context` from `traceparent`/`tracestate` and activate inbound `baggage` — without `@mokei/context-server` importing `@opentelemetry/api` directly. Reciprocates the outbound path mokei's `context-client` already ships.

## What was built

Three additions to `@enkaku/otel`, each the inverse/counterpart of an existing export, reusing the existing parsing primitives (`parseTraceparent`/`parseTracestate`/`parseBaggage`):

- **`entriesToBaggage(entries): Baggage`** (`baggage.ts`) — inverse of `baggageToEntries`. Folds structured `properties` back into OTel per-entry metadata via a private `propertiesToMetadata` serializer; lossless round-trip. Drops non-token keys, first-occurrence-wins on duplicates, never throws.
- **`extractW3CTraceContext(meta): Context | undefined`** (`context.ts`) — W3C-`traceparent` counterpart to `extractTraceContext`. Returns `undefined` when no valid `traceparent` (callers pay nothing when tracing off).
- **`withActiveBaggage(entries, fn)`** (`tracers.ts`) — activates baggage for a callback, symmetric with read-only `getActiveBaggage`. Pairs with existing `withActiveContext`.

All three exported from `index.ts`.

## Key design decisions

- **Two independent functions, not a combined builder** — baggage activation is separate from trace extraction so baggage still activates when `traceparent` is absent. The consumer wraps dispatch with both.
- **Full baggage fidelity** — W3C property tails are activated, so a handler's `getActiveBaggage()` round-trips what the client sent; symmetric with the existing read path.
- **Parsed traceFlags** — `extractW3CTraceContext` uses the flags parsed from `traceparent`, not the hardcoded `TraceFlags.SAMPLED` the `tid`/`sid` variant uses (W3C carries real flags). It is also stricter than `extractTraceContext` (validates the traceparent grammar), improving posture against untrusted `_meta`.
- **Sanitized tracestate** — passed through `parseTracestate` → `formatTracestate` → `createTraceState`, attached only when non-empty.
- **No new runtime dependencies** — `createTraceState`, `baggageEntryMetadataFromString`, `propagation.createBaggage/setBaggage` all come from the already-present `@opentelemetry/api`.

## Notable findings during review

- Final review caught `entriesToBaggage` silently dropping prototype-named baggage keys (`__proto__`, `toString`, `constructor`, …) because the dedup guard `entry.key in record` walked the prototype chain of a plain-object accumulator — a real defect on untrusted input. Fixed with an `Object.create(null)` accumulator plus regression coverage (including `__proto__`).
- Deferred cosmetic minors: `context.ts` JSDoc references `_meta` (the accurate MCP wire field name, not the param name); `parseTraceparent` accepts an all-zero trace id (pre-existing, rejected by the OTel SDK downstream).

## Verification

`@enkaku/otel`: `test:types` clean, 96 unit tests pass, repo lint clean (549 files).

## Remaining work (separate repo)

The mokei consumer follow-on — add `@enkaku/otel` to `@mokei/context-server`, add `src/trace.ts` with `activeContextFromMeta(meta) → extractW3CTraceContext(meta)`, wrap the `_handleRequest` dispatch once with `withActiveContext` (+ `withActiveBaggage` when present) — is tracked in the origin backlog doc and lives in the mokei repo. No enkaku-side blocker remains.
