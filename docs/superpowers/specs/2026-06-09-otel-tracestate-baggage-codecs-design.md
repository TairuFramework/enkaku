# Design: `@enkaku/otel` — `tracestate` and `baggage` codecs

**Date:** 2026-06-09
**Ask:** [`2026-06-09-otel-tracestate-baggage-codecs.md`](./2026-06-09-otel-tracestate-baggage-codecs.md)
**Package:** `@enkaku/otel` (`packages/otel/src/`)

## Goal

Complete the W3C Trace Context propagation surface in `@enkaku/otel` by adding pure,
unit-testable `tracestate` and `baggage` header codecs alongside the existing
`traceparent` codec (`src/traceparent.ts`). Unblocks mokei's MCP draft-migration item
G5, which maps the full `traceparent` / `tracestate` / `baggage` trio into request
`_meta`.

## Scope

Two new codec modules plus tests and entrypoint exports. No changes to
`context.ts` (`tid`/`sid` injection stays as-is). No mutation/ordering semantics — these
are stateless format/parse codecs that preserve the caller-given order.

## Module layout

Mirror `traceparent.ts`:

- `src/tracestate.ts` — `formatTracestate`, `parseTracestate`, `type TracestateEntry`
- `src/baggage.ts` — `formatBaggage`, `parseBaggage`, `type BaggageEntry`,
  `type BaggageProperty`
- `test/tracestate.test.ts`, `test/baggage.test.ts` — Vitest, mirroring
  `test/traceparent.test.ts`

Each module obtains a warning logger via `getEnkakuLogger('otel')` from `@enkaku/log`
(already a dependency). Logtape loggers are no-op until configured, so this is safe and
silent in tests. No logger injection, no new shared file.

## Type shapes

```ts
type TracestateEntry = { key: string; value: string }

type BaggageProperty = { key: string; value?: string } // value omitted = valueless (`;secure`)
type BaggageEntry = { key: string; value: string; properties?: Array<BaggageProperty> }
```

- `parseTracestate(header) => Array<TracestateEntry>`
- `parseBaggage(header) => Array<BaggageEntry>`
- Format functions accept the same array types.

The `BaggageProperty` array faithfully represents both valueless properties (`;secure`)
and `key=value` properties, and round-trips cleanly.

## Codec semantics

### `tracestate` — W3C Trace Context §3.3

Member grammar: comma-separated `key=value`, optional whitespace (OWS) around members.
Key charset: lowercase `a-z`, `0-9`, `_`, `-`, `*`, `/`, with the multi-tenant `@`
vendor form. Value charset: printable ASCII `0x20`–`0x7E` excluding `,` and `=`, no
trailing space.

- **format:** join validated members as `key=value` with `,`. Drop members failing the
  key/value charset rules; cap at **32** entries; preserve given order. Emit a
  `logger.warn` naming each dropped/truncated member.
- **parse:** split on `,`, trim OWS, drop malformed members, drop duplicate keys
  (**keep first occurrence**), cap at 32. Never throw.

### `baggage` — W3C Baggage

Member grammar: comma-separated `key=value`, each member optionally followed by
`;`-delimited properties. Values are percent-encoded.

- **format:** emit `key=percentEncode(value)`; append properties as `;pkey` (valueless)
  or `;pkey=pval`, joined by `;`. Drop members/properties failing charset/encoding
  rules; preserve given order; **no entry-count cap** (the 32 cap is tracestate-specific).
  Emit a `logger.warn` for each dropped member/property.
- **parse:** split members on `,`, split each member's tail on `;` into properties,
  percent-decode values, drop malformed members/properties. Never throw.

### Round-trip guarantee

For valid input, `parse(format(x))` reproduces `x` (modulo dropped-invalid and the
tracestate 32-cap). This is the primary correctness test for both codecs.

## Exports

Add to `src/index.ts`:

```ts
export { formatTracestate, parseTracestate, type TracestateEntry } from './tracestate.js'
export {
  formatBaggage,
  parseBaggage,
  type BaggageEntry,
  type BaggageProperty,
} from './baggage.js'
```

## Testing

Vitest, mirroring `test/traceparent.test.ts`:

- format happy path (single + multiple members)
- parse happy path
- round-trip (`parse(format(x))`)
- malformed members dropped, not thrown (parse)
- invalid members dropped + warned (format)
- tracestate: 32-entry cap; duplicate-key keep-first; charset rejection
- baggage: percent-encode/decode round-trip; valueless + `key=value` properties;
  charset rejection

## Acceptance

- `parseTracestate(formatTracestate(x))` round-trips; malformed members are dropped, not
  thrown.
- `parseBaggage(formatBaggage(x))` round-trips with properties and percent-encoding.
- Both codecs exported from the package entrypoint.

## Decisions log

- **Baggage property type:** `Array<{ key; value? }>` — faithful to W3C, round-trips,
  represents valueless properties.
- **Format-side invalid input:** skip invalid members + cap (tracestate 32), and
  `warn` — symmetric with lenient parse, format never throws.
- **Warning channel:** `@enkaku/log` via `getEnkakuLogger('otel')` (already a
  dependency), not `console` or an injected callback.
- **Duplicate tracestate keys on parse:** keep first occurrence, drop later (W3C: dups
  invalid).
- **Baggage count limit:** none (32 cap is tracestate-only); enforce only
  charset/encoding validity.
