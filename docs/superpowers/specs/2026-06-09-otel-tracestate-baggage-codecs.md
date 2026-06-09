# Upstream ask: `@enkaku/otel` — `tracestate` and `baggage` codecs

**Filed by:** mokei MCP draft-migration work (`feat/mcp-spec-update`, item G5).
**Affected package:** `@enkaku/otel` (`packages/otel/src/`).
**Status as of 2026-06-09:** blocking the full G5 trio — mokei can do `traceparent`-only
today, but not `tracestate`/`baggage`.

## Problem

`@enkaku/otel` covers only part of the W3C Trace Context propagation surface:

- `formatTraceparent` / `parseTraceparent` (`src/traceparent.ts`) — W3C **`traceparent`**
  header, version `00` only. Good.
- `injectTraceContext` / `extractTraceContext` (`src/context.ts`) — use enkaku's own
  compact fields `tid`/`sid`, **not** the standard `traceparent`/`tracestate` headers.

There is **no `tracestate`** codec and **no `baggage`** (W3C Baggage) codec anywhere in
the package (grep of `src/` for `tracestate`/`baggage` returns nothing).

## Why mokei needs it

The MCP draft maps W3C trace context into request `_meta` (item G5), expecting the full
trio: `traceparent`, `tracestate`, and `baggage`. mokei would wire `@enkaku/otel` into the
outgoing-request builder (`context-client` / `context-rpc`) to populate `_meta`. With only
`traceparent` available, mokei can implement a partial G5 and must document the
`tracestate`/`baggage` gap; full standards-compliant propagation needs upstream codecs.

## Proposed change

Add pure, unit-testable codecs mirroring `traceparent.ts`:

- **`tracestate`** — `formatTracestate(entries)` / `parseTracestate(header)` per W3C Trace
  Context §3.3: comma-separated `key=value` list, key/value charset + ordering rules,
  max 32 entries, drop malformed members rather than throwing.
- **`baggage`** — `formatBaggage(entries)` / `parseBaggage(header)` per W3C Baggage:
  comma-separated `key=value` with optional `;`-delimited properties, percent-encoded
  values.

Export them from `src/index.ts` alongside `formatTraceparent`/`parseTraceparent`. Type
shapes can follow `TraceparentData`'s lead (e.g. `Array<{ key: string; value: string }>`
for tracestate; baggage entries carrying optional properties).

## Acceptance

- `parseTracestate(formatTracestate(x))` round-trips; malformed members are dropped, not
  thrown.
- `parseBaggage(formatBaggage(x))` round-trips with properties and percent-encoding.
- Both exported from the package entrypoint.

## Verification notes (2026-06-09)

Confirmed against enkaku `main`: `src/otel/index.ts` exports only
`formatTraceparent`/`parseTraceparent` for header codecs; `injectTraceContext`/
`extractTraceContext` in `src/context.ts` emit `tid`/`sid`, not W3C headers. No
`tracestate`/`baggage` source present.
