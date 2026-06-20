# Upstream ask for mokei G5 inbound: W3C trace-context extraction + baggage activation

**Status:** requested
**Date:** 2026-06-20
**Package:** `@enkaku/otel`
**Origin:** mokei MCP draft-migration, item **G5 inbound** (server-side W3C trace
propagation). Outbound already ships: mokei's `context-client` injects SEP-414
`traceparent` / `tracestate` / `baggage` into request `_meta` using
`formatTraceparent` / `formatBaggage`. The server side cannot reciprocate with the
current API.

## Problem

`@enkaku/otel` exposes `extractTraceContext(header)`, but it reads Enkaku's own
`header.tid` / `header.sid` token fields — **not** the W3C `traceparent` mokei emits.
There is no W3C → `Context` builder, and no way to activate inbound baggage
(`getActiveBaggage` is read-only; no setter is exported). A mokei server therefore
cannot run a request handler under the client's trace/baggage without importing
`@opentelemetry/api` directly, which we want to avoid in `@mokei/context-server`.

## Asks

### 1. `extractW3CTraceContext(meta: Record<string, unknown>): Context | undefined`

Mirror the existing `extractTraceContext`, but for the W3C trio:

- Parse `meta.traceparent` via the existing `parseTraceparent`; if absent/invalid,
  return `undefined`.
- Parse `meta.tracestate` via the existing `parseTracestate` (optional).
- Build a remote `SpanContext` (`isRemote: true`) from the parsed
  `traceID` / `spanID` / `traceFlags`, attach any tracestate, and return the OTel
  `Context` (same `trace.setSpanContext(ROOT_CONTEXT, …)` shape the `tid`/`sid`
  variant already uses).

Returns `undefined` when no valid `traceparent` is present, so callers pay nothing
when tracing is off. Pairs with the existing `withActiveContext(ctx, fn)` for
activation.

### 2. `withActiveBaggage<T>(entries: Array<BaggageEntry>, fn: () => T): T`

Activate parsed `baggage` entries (from the existing `parseBaggage`) so a handler's
`getActiveBaggage()` reflects the client's baggage. Symmetric with the existing
read-only `getActiveBaggage`. (Naming/shape at enkaku's discretion — mokei only needs
"activate these entries for the duration of `fn`".)

## Consumer follow-on (mokei, separate repo)

Once released: add `@enkaku/otel` to `@mokei/context-server`, add
`src/trace.ts` with `activeContextFromMeta(meta) → extractW3CTraceContext(meta)`, and
wrap the `_handleRequest` dispatch once with `withActiveContext` (+ `withActiveBaggage`
when present). One wrap covers tools / prompts / resources.

## Notes

- Self-contained within `@enkaku/otel`; all parsing primitives
  (`parseTraceparent` / `parseTracestate` / `parseBaggage`) already exist.
- No mokei-side blocker beyond this release.
