# `@enkaku/otel` W3C Inbound Trace + Baggage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a server build an OTel `Context` from a client's W3C `traceparent`/`tracestate` and activate the client's `baggage`, without consumers importing `@opentelemetry/api`.

**Architecture:** Three small additions to `@enkaku/otel`, each reusing existing parsing primitives. `entriesToBaggage` (mirror of `baggageToEntries`) converts enkaku baggage entries into an OTel `Baggage`. `extractW3CTraceContext` (mirror of `extractTraceContext`) builds a remote-span `Context` from `_meta`. `withActiveBaggage` (mirror of `getActiveBaggage`) activates entries for the duration of a callback.

**Tech Stack:** TypeScript, `@opentelemetry/api`, vitest.

## Global Constraints

- Use `type`, never `interface`.
- Names: `ID` not `Id`, `HTTP` not `Http`, `W3C` (uppercase). `Array<T>`, never `T[]`.
- No `any` — use `unknown` / specific types.
- Use `pnpm`, never `npm`/`npx`.
- No new runtime dependencies — everything needed is already in `@opentelemetry/api`.
- Tests run with **no `ContextManager` registered**, so `context.with(...)` does not propagate `context.active()` inside the callback. `with*` wrappers are tested for return value only (matching existing `withActiveContext` / `withSpan` tests); activation correctness is proven via the pure `entriesToBaggage` round-trip.
- Lint command for this repo: `rtk proxy pnpm run lint` (not bare `pnpm run lint`).

---

### Task 1: `entriesToBaggage` (baggage.ts)

**Files:**
- Modify: `packages/otel/src/baggage.ts`
- Modify: `packages/otel/src/index.ts`
- Test: `packages/otel/test/baggage.test.ts`

**Interfaces:**
- Consumes: existing `BaggageEntry`, `BaggageProperty`, `isToken`, `safeEncode`, `logger`, `baggageToEntries` (all in `baggage.ts`).
- Produces: `entriesToBaggage(entries: Array<BaggageEntry>): Baggage` — reverse of `baggageToEntries`. First occurrence of a duplicate key wins; non-token member keys are dropped. Used by Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `packages/otel/test/baggage.test.ts`. Add `entriesToBaggage` to the import on line 4 (`import { baggageToEntries, entriesToBaggage, formatBaggage, parseBaggage } from '../src/baggage.js'`):

```ts
describe('entriesToBaggage', () => {
  test('round-trips plain entries through baggageToEntries', () => {
    const entries = [
      { key: 'userId', value: 'alice smith,jr' },
      { key: 'region', value: 'eu' },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual(entries)
  })

  test('round-trips entries with properties (lossless)', () => {
    const entries = [
      { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual(entries)
  })

  test('round-trips a property value with special characters', () => {
    const entries = [
      { key: 'k', value: 'v', properties: [{ key: 'note', value: 'hello world' }] },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual(entries)
  })

  test('drops members with invalid (non-token) keys', () => {
    const entries = [
      { key: 'bad key', value: 'v' },
      { key: 'good', value: 'v' },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual([{ key: 'good', value: 'v' }])
  })

  test('keeps the first occurrence of a duplicate key', () => {
    const entries = [
      { key: 'a', value: '1' },
      { key: 'a', value: '2' },
    ]
    expect(baggageToEntries(entriesToBaggage(entries))).toEqual([{ key: 'a', value: '1' }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/otel && pnpm exec vitest run test/baggage.test.ts -t entriesToBaggage`
Expected: FAIL — `entriesToBaggage is not a function` / import error.

- [ ] **Step 3: Implement `entriesToBaggage`**

In `packages/otel/src/baggage.ts`, change the top import (currently `import type { Baggage } from '@opentelemetry/api'`) to:

```ts
import {
  type Baggage,
  type BaggageEntryMetadata,
  baggageEntryMetadataFromString,
  propagation,
} from '@opentelemetry/api'
```

Append at the end of the file:

```ts
// Serialize structured properties into a W3C metadata tail (`k=v;k2;k3=v3`),
// percent-encoding values — the inverse of the `parseProperties` step in
// `baggageToEntries`. Drops properties with non-token keys or un-encodable
// values, same tolerance as `formatBaggage`.
function propertiesToMetadata(properties: Array<BaggageProperty>): string {
  const out: Array<string> = []
  for (const prop of properties) {
    if (!isToken(prop.key)) {
      logger.warn('dropping invalid baggage property {key}', { key: prop.key })
      continue
    }
    if (prop.value === undefined) {
      out.push(prop.key)
    } else {
      const encoded = safeEncode(prop.value)
      if (encoded === undefined) {
        logger.warn('dropping baggage property with un-encodable value {key}', { key: prop.key })
        continue
      }
      out.push(`${prop.key}=${encoded}`)
    }
  }
  return out.join(';')
}

/**
 * Convert enkaku `BaggageEntry` records into an OpenTelemetry `Baggage`. The
 * inverse of `baggageToEntries`: structured `properties` are folded back into
 * OTel's opaque per-entry metadata string, so the result round-trips losslessly.
 * Drops members with non-token keys and keeps the first occurrence of a
 * duplicate key. Never throws.
 */
export function entriesToBaggage(entries: Array<BaggageEntry>): Baggage {
  const record: Record<string, { value: string; metadata?: BaggageEntryMetadata }> = {}
  for (const entry of entries) {
    if (!isToken(entry.key)) {
      logger.warn('dropping invalid baggage member {key}', { key: entry.key })
      continue
    }
    if (entry.key in record) {
      continue
    }
    const tail = entry.properties ? propertiesToMetadata(entry.properties) : ''
    record[entry.key] =
      tail === ''
        ? { value: entry.value }
        : { value: entry.value, metadata: baggageEntryMetadataFromString(tail) }
  }
  return propagation.createBaggage(record)
}
```

In `packages/otel/src/index.ts`, add `entriesToBaggage` to the `./baggage.js` export block (keep alphabetical):

```ts
export {
  type BaggageEntry,
  type BaggageProperty,
  baggageToEntries,
  entriesToBaggage,
  formatBaggage,
  parseBaggage,
} from './baggage.js'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/otel && pnpm exec vitest run test/baggage.test.ts -t entriesToBaggage`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/otel/src/baggage.ts packages/otel/src/index.ts packages/otel/test/baggage.test.ts
git commit -m "feat(otel): add entriesToBaggage"
```

---

### Task 2: `extractW3CTraceContext` (context.ts)

**Files:**
- Modify: `packages/otel/src/context.ts`
- Modify: `packages/otel/src/index.ts`
- Test: `packages/otel/test/context.test.ts`

**Interfaces:**
- Consumes: existing `parseTraceparent` (`traceparent.js`), `parseTracestate` + `formatTracestate` (`tracestate.js`), `createTraceState` / `ROOT_CONTEXT` / `trace` (`@opentelemetry/api`).
- Produces: `extractW3CTraceContext(meta: Record<string, unknown>): Context | undefined` — a `Context` carrying a remote `SpanContext` (`isRemote: true`) with the parsed `traceFlags`, or `undefined` when `meta.traceparent` is absent / not a string / invalid. Pairs with the existing `withActiveContext`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/otel/test/context.test.ts`. Add `extractW3CTraceContext` to the import block (lines 4-9):

```ts
describe('extractW3CTraceContext', () => {
  const traceparent = '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-01'

  test('returns undefined when traceparent is absent', () => {
    expect(extractW3CTraceContext({})).toBeUndefined()
  })

  test('returns undefined when traceparent is not a string', () => {
    expect(extractW3CTraceContext({ traceparent: 123 })).toBeUndefined()
  })

  test('returns undefined for a malformed traceparent', () => {
    expect(extractW3CTraceContext({ traceparent: 'garbage' })).toBeUndefined()
  })

  test('builds a remote SpanContext from a valid traceparent', () => {
    const ctx = extractW3CTraceContext({ traceparent })
    expect(ctx).toBeDefined()
    const span = trace.getSpan(ctx as NonNullable<typeof ctx>)
    const spanCtx = (span as NonNullable<typeof span>).spanContext()
    expect(spanCtx.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
    expect(spanCtx.spanId).toBe('00f067aa0ba902b7')
    expect(spanCtx.traceFlags).toBe(1)
    expect(spanCtx.isRemote).toBe(true)
  })

  test('uses the parsed trace flags rather than a hardcoded value', () => {
    const ctx = extractW3CTraceContext({
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-00f067aa0ba902b7-00',
    })
    const span = trace.getSpan(ctx as NonNullable<typeof ctx>)
    expect((span as NonNullable<typeof span>).spanContext().traceFlags).toBe(0)
  })

  test('attaches tracestate when present', () => {
    const ctx = extractW3CTraceContext({ traceparent, tracestate: 'vendor=value' })
    const span = trace.getSpan(ctx as NonNullable<typeof ctx>)
    expect((span as NonNullable<typeof span>).spanContext().traceState?.get('vendor')).toBe('value')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/otel && pnpm exec vitest run test/context.test.ts -t extractW3CTraceContext`
Expected: FAIL — `extractW3CTraceContext is not a function` / import error.

- [ ] **Step 3: Implement `extractW3CTraceContext`**

In `packages/otel/src/context.ts`, extend the `@opentelemetry/api` import to add `createTraceState` (value) and `type SpanContext`:

```ts
import {
  type Context,
  context,
  createTraceState,
  ROOT_CONTEXT,
  type Span,
  type SpanContext,
  TraceFlags,
  trace,
} from '@opentelemetry/api'
```

Add the local imports below the existing `./semantic.js` import:

```ts
import { parseTraceparent } from './traceparent.js'
import { formatTracestate, parseTracestate } from './tracestate.js'
```

Append after `extractTraceContext` (before `withActiveContext`):

```ts
/**
 * Build an OTel Context from a request's W3C trace headers in `_meta`. Parses
 * `meta.traceparent` (and optional `meta.tracestate`) into a remote SpanContext.
 * Returns undefined when no valid `traceparent` is present, so callers pay
 * nothing when tracing is off. Pairs with `withActiveContext` for activation.
 */
export function extractW3CTraceContext(meta: Record<string, unknown>): Context | undefined {
  const traceparent = meta.traceparent
  if (typeof traceparent !== 'string') {
    return undefined
  }
  const parsed = parseTraceparent(traceparent)
  if (parsed == null) {
    return undefined
  }
  const spanContext: SpanContext = {
    traceId: parsed.traceID,
    spanId: parsed.spanID,
    traceFlags: parsed.traceFlags,
    isRemote: true,
  }
  if (typeof meta.tracestate === 'string') {
    const formatted = formatTracestate(parseTracestate(meta.tracestate))
    if (formatted !== '') {
      spanContext.traceState = createTraceState(formatted)
    }
  }
  return trace.setSpanContext(ROOT_CONTEXT, spanContext)
}
```

> Note: `TraceFlags` stays imported — it is still used by `extractTraceContext`.

In `packages/otel/src/index.ts`, add `extractW3CTraceContext` to the `./context.js` export block (keep alphabetical):

```ts
export {
  extractTraceContext,
  extractW3CTraceContext,
  injectTraceContext,
  setSpanOnContext,
  withActiveContext,
} from './context.js'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/otel && pnpm exec vitest run test/context.test.ts -t extractW3CTraceContext`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/otel/src/context.ts packages/otel/src/index.ts packages/otel/test/context.test.ts
git commit -m "feat(otel): add extractW3CTraceContext"
```

---

### Task 3: `withActiveBaggage` (tracers.ts)

**Files:**
- Modify: `packages/otel/src/tracers.ts`
- Modify: `packages/otel/src/index.ts`
- Test: `packages/otel/test/tracers.test.ts`

**Interfaces:**
- Consumes: `entriesToBaggage` (Task 1), existing `context` / `propagation` (`@opentelemetry/api`), `BaggageEntry` (`baggage.js`).
- Produces: `withActiveBaggage<T>(entries: Array<BaggageEntry>, fn: () => T): T` — runs `fn` with the given baggage activated, returns `fn`'s result. Symmetric with `getActiveBaggage`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/otel/test/tracers.test.ts`. Add `withActiveBaggage` to the import block (lines 3-10):

```ts
describe('withActiveBaggage', () => {
  // No ContextManager is registered in tests, so context.active() inside fn is
  // still ROOT; we assert the wrapper returns fn's result (matching withSpan).
  // Activation correctness is covered by the entriesToBaggage round-trip tests.
  test('executes the function and returns its result', () => {
    const result = withActiveBaggage([{ key: 'userId', value: 'alice' }], () => 42)
    expect(result).toBe(42)
  })

  test('accepts empty entries', () => {
    expect(withActiveBaggage([], () => 'ok')).toBe('ok')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/otel && pnpm exec vitest run test/tracers.test.ts -t withActiveBaggage`
Expected: FAIL — `withActiveBaggage is not a function` / import error.

- [ ] **Step 3: Implement `withActiveBaggage`**

In `packages/otel/src/tracers.ts`, add `entriesToBaggage` to the `./baggage.js` import (line 4):

```ts
import { type BaggageEntry, baggageToEntries, entriesToBaggage } from './baggage.js'
```

Append at the end of the file:

```ts
/**
 * Activate the given baggage entries for the duration of `fn`, so a handler's
 * `getActiveBaggage()` reflects the client's baggage. Symmetric with the
 * read-only `getActiveBaggage`.
 */
export function withActiveBaggage<T>(entries: Array<BaggageEntry>, fn: () => T): T {
  const baggage = entriesToBaggage(entries)
  return context.with(propagation.setBaggage(context.active(), baggage), fn)
}
```

In `packages/otel/src/index.ts`, add `withActiveBaggage` to the `./tracers.js` export block (keep alphabetical):

```ts
export {
  createTracer,
  getActiveBaggage,
  getActiveSpan,
  getActiveTraceContext,
  type TraceContext,
  withActiveBaggage,
  withSpan,
  withSyncSpan,
} from './tracers.js'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/otel && pnpm exec vitest run test/tracers.test.ts -t withActiveBaggage`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/otel/src/tracers.ts packages/otel/src/index.ts packages/otel/test/tracers.test.ts
git commit -m "feat(otel): add withActiveBaggage"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full otel package test suite (types + unit)**

Run: `cd packages/otel && pnpm run test`
Expected: PASS — type check clean, all unit tests green (including the new `entriesToBaggage`, `extractW3CTraceContext`, `withActiveBaggage` suites).

- [ ] **Step 2: Lint**

Run (from repo root): `rtk proxy pnpm run lint`
Expected: no errors; if the formatter reorders imports/exports, restage and amend.

- [ ] **Step 3: Confirm public surface**

Verify `packages/otel/src/index.ts` now exports `entriesToBaggage`, `extractW3CTraceContext`, and `withActiveBaggage`. These are the symbols `@mokei/context-server` will consume.

- [ ] **Step 4: Commit any lint fixups**

```bash
git add -A && git commit -m "chore(otel): lint fixups for W3C inbound" || echo "nothing to commit"
```
