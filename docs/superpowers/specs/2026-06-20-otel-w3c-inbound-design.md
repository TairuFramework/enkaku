# Design: `@enkaku/otel` W3C trace-context extraction + baggage activation

**Date:** 2026-06-20
**Package:** `@enkaku/otel`
**Origin:** mokei MCP draft-migration, item G5 inbound (server-side W3C trace
propagation). See `docs/agents/plans/backlog/2026-06-20-mokei-g5-inbound-otel.md`.

## Problem

`@enkaku/otel` extracts trace context only from Enkaku token fields
(`header.tid` / `header.sid`), not the W3C `traceparent` that mokei's
`context-client` injects into request `_meta`. There is also no way to activate
inbound baggage (`getActiveBaggage` is read-only). A mokei server therefore
cannot run a handler under the client's trace/baggage without importing
`@opentelemetry/api` directly in `@mokei/context-server`, which we want to avoid.

All parsing primitives already exist: `parseTraceparent`, `parseTracestate`,
`parseBaggage`, `baggageToEntries`. `createTraceState`,
`baggageEntryMetadataFromString`, `propagation.createBaggage`, and
`propagation.setBaggage` are available from `@opentelemetry/api` (the package's
only OTel dependency).

## Decisions

- **API shape:** two independent functions, mirroring the existing read path.
  Baggage activation is separate from trace extraction so baggage still
  activates when `traceparent` is absent. mokei wraps dispatch with both.
- **Baggage fidelity:** full W3C properties (the `;`-tail) are activated, so
  `getActiveBaggage` inside the handler round-trips what the client sent.
  Symmetric with the existing `baggageToEntries` read path.
- **traceFlags:** use the flags parsed from `traceparent` (not the hardcoded
  `TraceFlags.SAMPLED` the `tid`/`sid` variant uses). W3C carries real flags.
- **tracestate:** sanitize through `parseTracestate` → `formatTracestate` →
  `createTraceState`, so only members valid under enkaku's grammar attach.
- **Placement:** `extractW3CTraceContext` in `context.ts` (next to
  `extractTraceContext`); `withActiveBaggage` in `tracers.ts` (next to
  `getActiveBaggage`); reverse helper `entriesToBaggage` in `baggage.ts`
  (mirror of `baggageToEntries`).

## Components

### `baggage.ts` — `entriesToBaggage(entries: Array<BaggageEntry>): Baggage`

Reverse of `baggageToEntries`. New internal `propertiesToMetadata(props)`
serializes the property tail (`k=v;k2;k3=v3`), percent-encoding values via the
existing `safeEncode` and dropping members/properties with non-token keys or
un-encodable values — same tolerance as `formatBaggage`. Builds the OTel
`Baggage` via:

```ts
propagation.createBaggage({
  [entry.key]: {
    value: entry.value,
    metadata: tail ? baggageEntryMetadataFromString(tail) : undefined,
  },
})
```

(accumulated into one record across all entries). Round-trips losslessly with
`baggageToEntries` for W3C-conformant input.

### `context.ts` — `extractW3CTraceContext(meta: Record<string, unknown>): Context | undefined`

- `meta.traceparent` not a `string` → `undefined`.
- `parseTraceparent(meta.traceparent)` returns `undefined` → `undefined`.
- If `meta.tracestate` is a `string`:
  `createTraceState(formatTracestate(parseTracestate(meta.tracestate)))` and
  attach as the SpanContext `traceState` (omit when empty).
- Return
  `trace.setSpanContext(ROOT_CONTEXT, { traceId, spanId, isRemote: true, traceFlags, traceState? })`.

Returns `undefined` when no valid `traceparent` is present, so callers pay
nothing when tracing is off. Pairs with the existing `withActiveContext`.

### `tracers.ts` — `withActiveBaggage<T>(entries: Array<BaggageEntry>, fn: () => T): T`

```ts
context.with(propagation.setBaggage(context.active(), entriesToBaggage(entries)), fn)
```

Empty `entries` → an empty baggage (harmless no-op). Symmetric with the existing
read-only `getActiveBaggage`.

### `index.ts`

Export `extractW3CTraceContext`, `withActiveBaggage`, and `entriesToBaggage`.

## Tests

- `context.test.ts`: valid `traceparent` → remote `SpanContext` carrying the
  parsed `traceId` / `spanId` / `traceFlags` and `isRemote: true`; `tracestate`
  attaches; missing / non-string / invalid `traceparent` → `undefined`.
- `baggage.test.ts`: `entriesToBaggage` → `baggageToEntries` round-trips,
  including properties; invalid keys dropped.
- `tracers.test.ts`: inside `withActiveBaggage(entries, …)`, `getActiveBaggage()`
  reflects `entries` (including properties); restored after `fn` returns.

## Error handling

Pure functions, never throw. Invalid / absent input degrades to `undefined`
(trace) or dropped members (baggage), matching the existing primitives. No new
dependencies.

## Consumer follow-on (mokei, separate repo)

Add `@enkaku/otel` to `@mokei/context-server`, add `src/trace.ts` with
`activeContextFromMeta(meta) → extractW3CTraceContext(meta)`, and wrap the
`_handleRequest` dispatch once with `withActiveContext` (+ `withActiveBaggage`
when baggage is present). One wrap covers tools / prompts / resources.
