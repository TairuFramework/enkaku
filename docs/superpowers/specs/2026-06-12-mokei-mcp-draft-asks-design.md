# Design: Mokei MCP-draft asks — otel active-baggage accessor + schema strict passthrough

**Date:** 2026-06-12
**Origin ask:** `docs/agents/plans/next/2026-06-11-mokei-mcp-draft-asks.md`
**Packages:** `@enkaku/otel`, `@enkaku/schema` (both currently `0.16.1`)

Two small, additive, independent enablers for mokei MCP-draft work. Defaults unchanged for existing consumers in both.

---

## 1. `@enkaku/otel` — `getActiveBaggage()` accessor — MEDIUM

### Problem

`@enkaku/otel` ships `formatBaggage`/`parseBaggage` codecs but no accessor for the *active* baggage, so a consumer has nothing to format from. `getActiveTraceContext()` surfaces trace/span/flags only; there is no baggage equivalent. Mokei's G5 (W3C trace-context propagation into MCP `_meta`, SEP-414) can emit `traceparent`/`tracestate` but cannot populate `baggage` without reaching past the wrapper into `@opentelemetry/api`.

### OTel ↔ enkaku model

- OTel `BaggageEntry = { value: string, metadata?: BaggageEntryMetadata }` where `BaggageEntryMetadata` is opaque `{ toString(): string }`. Per the W3C baggage grammar `member = key "=" value *( ";" property )`, the OTel propagator collapses the **entire property tail** (everything after the value's first `;`) into ONE opaque metadata string; it does not structure properties.
- Enkaku `BaggageEntry = { key, value, properties?: Array<{ key, value? }> }` **does** structure them.
- Therefore enkaku's `properties[]` is the parsed form of OTel's metadata string. Parsing `metadata.toString()` with the same property grammar reverses the collapse exactly → **lossless** for W3C-conformant baggage.
- Value encoding lines up: OTel stores values **decoded** in memory (propagator decodes on parse); enkaku `BaggageEntry.value` is also decoded. Metadata is stored **raw** (un-decoded); the shared property parser runs `safeDecode` on property values. So `getActiveBaggage() → formatBaggage()` round-trips faithfully.

### Design

**Extract a shared property parser in `packages/otel/src/baggage.ts`.** The property-parse loop currently inline in `parseBaggage` (lines 101–125) becomes:

```ts
function parseProperties(segments: Array<string>): Array<BaggageProperty> {
  const properties: Array<BaggageProperty> = []
  for (const raw of segments) {
    const prop = raw.trim()
    if (prop === '') continue
    const pEq = prop.indexOf('=')
    if (pEq === -1) {
      if (!isToken(prop)) continue
      properties.push({ key: prop })
    } else {
      const pKey = prop.slice(0, pEq).trim()
      const pVal = safeDecode(prop.slice(pEq + 1).trim())
      if (!isToken(pKey) || pVal === undefined) continue
      properties.push({ key: pKey, value: pVal })
    }
  }
  return properties
}
```

- `parseBaggage` calls `parseProperties(parts.slice(1))` — pure refactor, no behavior change.

**Add `getActiveBaggage()` in `packages/otel/src/tracers.ts`** (groups with `getActiveTraceContext`/`getActiveSpan`, all `context.active()` accessors together; imports `BaggageEntry`/the `parseProperties` mapping helper from `baggage.js`):

```ts
export function getActiveBaggage(): Array<BaggageEntry> | undefined {
  const baggage = propagation.getBaggage(context.active())
  if (baggage == null) return undefined
  const all = baggage.getAllEntries()
  if (all.length === 0) return undefined
  return all.map(([key, e]) => {
    const entry: BaggageEntry = { key, value: e.value }
    if (e.metadata != null) {
      const props = parseProperties(e.metadata.toString().split(';'))
      if (props.length > 0) entry.properties = props
    }
    return entry
  })
}
```

- Returns `undefined` when no SDK/baggage active **or** baggage empty.
- Composes: `formatBaggage(getActiveBaggage() ?? [])`.
- `parseProperties` must be reachable from `tracers.ts` — export it from `baggage.ts` as an internal (module-level, not re-exported from `index.ts`), or co-locate a thin `baggageFromOTel` mapper in `baggage.ts` and call that from `tracers.ts`. Implementation chooses; public surface adds only `getActiveBaggage`.

**Export `getActiveBaggage` from `packages/otel/src/index.ts`** next to `getActiveTraceContext`.

### Documented edge

OTel spec states metadata "currently has no special meaning" — a producer could store non-property junk. `parseProperties` drops malformed segments (same tolerance enkaku applies in `parseBaggage`). Lossless for W3C-conformant baggage; degrades gracefully otherwise.

### Done when

- `@enkaku/otel` exports `getActiveBaggage(): Array<BaggageEntry> | undefined`.
- Unit test: set baggage (incl. an entry with metadata/properties) on the active context via `propagation.setBaggage(context.active(), …)`, assert returned entries match key/value/properties; assert a metadata-carrying entry round-trips through `formatBaggage` → `parseBaggage` unchanged; assert `undefined` when no baggage/SDK active and when baggage is empty.

---

## 2. `@enkaku/schema` — `strict` passthrough on `ValidatorOptions` — LOW

### Problem

`createValidator`/`createStandardValidator` with `{ draft: '2020-12' }` build `Ajv2020` in AJV default strict mode, which logs warnings to stderr for *valid* 2020-12 constructs (e.g. a `prefixItems` 2-tuple without `minItems`/`maxItems`). No option to quiet/downgrade. Mokei G8 (schemas opt into 2020-12 via `$schema`) leaks these to user consoles.

### Design — `packages/schema/src/validation.ts`

```ts
export type ValidatorOptions = { draft?: '07' | '2020-12'; strict?: boolean | 'log' }
```

- `strict` mirrors AJV's own `strict` values (`true | false | 'log'`).
- Cache must key on strict too — current `Map<'07' | '2020-12', …>` would silently reuse the first instance built for a draft, ignoring later differing `strict` (the exact first-call-wins footgun these asks warn against). Re-key the cache by `` `${draft}:${strict ?? 'default'}` ``:

```ts
const instances = new Map<string, Ajv | Ajv2020>()

function getAjv(draft: '07' | '2020-12', strict?: boolean | 'log'): Ajv | Ajv2020 {
  const key = `${draft}:${strict ?? 'default'}`
  let instance = instances.get(key)
  if (instance == null) {
    const options = { allErrors: true, useDefaults: false, ...(strict !== undefined && { strict }) }
    instance = draft === '2020-12' ? new Ajv2020(options) : new Ajv(options)
    // @ts-expect-error missing type definition
    addFormats(instance)
    instances.set(key, instance)
  }
  return instance
}
```

- `strict` undefined → omitted from AJV options → **current behavior unchanged**.
- `createValidator` passes `options?.strict` to `getAjv`.

### Done when

- `ValidatorOptions` accepts `strict?: boolean | 'log'`.
- Unit test: a 2020-12 `prefixItems` 2-tuple schema validates with **no** strict-mode warning when `strict: false`, and **still warns by default**.
- Cache test: two validators, same draft, different `strict`, both honored (distinct instances).

---

## Out of scope

- Version bumps / publishing — handled separately by the user.
- Mokei-side consumption (G5 baggage population, G8 strict opt-in) — tracked in mokei backlog.
