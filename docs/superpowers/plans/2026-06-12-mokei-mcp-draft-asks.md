# Mokei MCP-draft asks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `getActiveBaggage()` to `@enkaku/otel` (lossless OTel→enkaku baggage mapping) and a `strict` passthrough option to `@enkaku/schema`'s validator factory.

**Architecture:** Two independent, additive changes. otel: extract the property-parse loop from `parseBaggage` into a shared `parseProperties` helper, add a pure `baggageToEntries(Baggage)` mapper (parses W3C metadata into structured properties — lossless), and a thin `getActiveBaggage()` reading active context. schema: extend `ValidatorOptions` with `strict`, re-key the AJV instance cache by `draft:strict` so differing strict values don't silently reuse a cached instance.

**Tech Stack:** TypeScript, `@opentelemetry/api`, AJV (`ajv` + `ajv/dist/2020.js`), vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-12-mokei-mcp-draft-asks-design.md`

**Conventions (from AGENTS.md):** `type` not `interface`; `Array<T>` not `T[]`; no `any`; names use `ID`/`HTTP` casing; `pnpm` only. Lint via `rtk proxy pnpm run lint` (NOT bare `pnpm run lint`). Per-package tests: `pnpm --filter @enkaku/otel run test:unit` / `pnpm --filter @enkaku/schema run test:unit`.

---

## Task 1: `@enkaku/schema` — `strict` passthrough

Independent of Task 1's sibling; do either first. Smaller, so first.

**Files:**
- Modify: `packages/schema/src/validation.ts` (`ValidatorOptions` line 13; `instances` map line 17; `getAjv` lines 19-29; `createValidator` call site line 43)
- Test: `packages/schema/test/lib.test.ts` (append a `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to `packages/schema/test/lib.test.ts`:

```ts
describe('ValidatorOptions.strict', () => {
  // A valid 2020-12 construct that AJV strict mode warns about: a prefixItems
  // 2-tuple with no minItems/maxItems.
  const tupleSchema = {
    $id: 'https://example.com/strict-tuple',
    type: 'array',
    prefixItems: [{ type: 'string' }, { type: 'number' }],
  } as const

  function captureWarnings(fn: () => void): Array<string> {
    const warnings: Array<string> = []
    const original = console.warn
    console.warn = (...args: Array<unknown>) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      fn()
    } finally {
      console.warn = original
    }
    return warnings
  }

  test('emits a strict-mode warning by default', () => {
    const warnings = captureWarnings(() => {
      createValidator(tupleSchema, { draft: '2020-12' })
    })
    expect(warnings.some((w) => w.toLowerCase().includes('strict'))).toBe(true)
  })

  test('suppresses the strict-mode warning when strict is false', () => {
    const warnings = captureWarnings(() => {
      createValidator(tupleSchema, { draft: '2020-12', strict: false })
    })
    expect(warnings.some((w) => w.toLowerCase().includes('strict'))).toBe(false)
  })

  test('caches distinct AJV instances per strict value (no first-call-wins)', () => {
    // Default (strict) first, then strict:false for the same draft. If the cache
    // were keyed by draft only, the second call would reuse the strict instance
    // and still warn.
    createValidator(tupleSchema, { draft: '2020-12' })
    const warnings = captureWarnings(() => {
      createValidator(tupleSchema, { draft: '2020-12', strict: false })
    })
    expect(warnings.some((w) => w.toLowerCase().includes('strict'))).toBe(false)
  })

  test('validates correctly with strict disabled', () => {
    const validate = createValidator(tupleSchema, { draft: '2020-12', strict: false })
    expect(validate(['a', 1])).toEqual({ value: ['a', 1] })
    expect(validate([1, 'a']) instanceof ValidationError).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/schema run test:unit -- lib.test.ts`
Expected: the `strict: false` cases FAIL (warning still emitted / `strict` not accepted by type). The "by default" and "validates correctly" cases may pass.

- [ ] **Step 3: Extend `ValidatorOptions`**

In `packages/schema/src/validation.ts`, replace line 13:

```ts
export type ValidatorOptions = { draft?: '07' | '2020-12'; strict?: boolean | 'log' }
```

- [ ] **Step 4: Re-key the cache and thread `strict` through `getAjv`**

Replace the `instances` map (line 17) and `getAjv` (lines 19-29) with:

```ts
// AJV instances are locked to a single dialect AND a single strict setting, so
// we cache one instance per (draft, strict) pair and construct them lazily.
const instances = new Map<string, Ajv | Ajv2020>()

function getAjv(draft: '07' | '2020-12', strict?: boolean | 'log'): Ajv | Ajv2020 {
  const key = `${draft}:${strict ?? 'default'}`
  let instance = instances.get(key)
  if (instance == null) {
    const options = {
      allErrors: true,
      useDefaults: false,
      ...(strict !== undefined && { strict }),
    }
    instance = draft === '2020-12' ? new Ajv2020(options) : new Ajv(options)
    // @ts-expect-error missing type definition
    addFormats(instance)
    instances.set(key, instance)
  }
  return instance
}
```

- [ ] **Step 5: Pass `strict` at the `createValidator` call site**

In `createValidator`, replace line 43:

```ts
  const ajv = getAjv(options?.draft ?? '07', options?.strict)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/schema run test:unit -- lib.test.ts`
Expected: PASS (all four new tests).

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm --filter @enkaku/schema run test` (includes type check), then `rtk proxy pnpm run lint`
Expected: no type errors; lint clean ("No fixes applied" or auto-formatted).

- [ ] **Step 8: Commit**

```bash
git add packages/schema/src/validation.ts packages/schema/test/lib.test.ts
git commit -m "feat(schema): strict passthrough on ValidatorOptions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: `@enkaku/otel` — `parseProperties` extraction + `baggageToEntries`

Refactor first (behavior-preserving), then build the mapper on top. Split from Task 3 so the refactor lands green before new surface is added.

**Files:**
- Modify: `packages/otel/src/baggage.ts` (extract from `parseBaggage` lines 101-125; add `baggageToEntries`)
- Test: `packages/otel/test/baggage.test.ts` (append a `describe` block)

- [ ] **Step 1: Write the failing test for `baggageToEntries`**

Append to `packages/otel/test/baggage.test.ts`. Update the import at the top of the file to add `baggageToEntries`:

```ts
import { baggageToEntries, formatBaggage, parseBaggage } from '../src/baggage.js'
```

Add the OTel import and the test block:

```ts
import { baggageEntryMetadataFromString, propagation } from '@opentelemetry/api'

describe('baggageToEntries', () => {
  test('maps plain key/value entries', () => {
    const bag = propagation.createBaggage({
      userId: { value: 'alice' },
      region: { value: 'eu' },
    })
    const entries = baggageToEntries(bag)
    expect(entries).toContainEqual({ key: 'userId', value: 'alice' })
    expect(entries).toContainEqual({ key: 'region', value: 'eu' })
    expect(entries).toHaveLength(2)
  })

  test('parses W3C metadata into structured properties (lossless)', () => {
    const bag = propagation.createBaggage({
      userId: { value: 'alice', metadata: baggageEntryMetadataFromString('ttl=30;internal') },
    })
    const entries = baggageToEntries(bag)
    expect(entries).toEqual([
      {
        key: 'userId',
        value: 'alice',
        properties: [{ key: 'ttl', value: '30' }, { key: 'internal' }],
      },
    ])
  })

  test('round-trips through formatBaggage -> parseBaggage', () => {
    const bag = propagation.createBaggage({
      userId: { value: 'alice', metadata: baggageEntryMetadataFromString('ttl=30;internal') },
    })
    const entries = baggageToEntries(bag)
    expect(parseBaggage(formatBaggage(entries))).toEqual(entries)
  })

  test('omits properties when metadata is empty', () => {
    const bag = propagation.createBaggage({ userId: { value: 'alice' } })
    expect(baggageToEntries(bag)).toEqual([{ key: 'userId', value: 'alice' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/otel run test:unit -- baggage.test.ts`
Expected: FAIL — `baggageToEntries` is not exported.

- [ ] **Step 3: Extract `parseProperties` from `parseBaggage`**

In `packages/otel/src/baggage.ts`, add this function above `parseBaggage` (after `formatBaggage`):

```ts
// Parse `;`-separated W3C property segments into structured properties. Shared by
// parseBaggage (member tail) and baggageToEntries (OTel opaque metadata string).
function parseProperties(segments: Array<string>): Array<BaggageProperty> {
  const properties: Array<BaggageProperty> = []
  for (const raw of segments) {
    const prop = raw.trim()
    if (prop === '') {
      continue
    }
    const pEq = prop.indexOf('=')
    if (pEq === -1) {
      if (!isToken(prop)) {
        continue
      }
      properties.push({ key: prop })
    } else {
      const pKey = prop.slice(0, pEq).trim()
      const pVal = safeDecode(prop.slice(pEq + 1).trim())
      if (!isToken(pKey) || pVal === undefined) {
        continue
      }
      properties.push({ key: pKey, value: pVal })
    }
  }
  return properties
}
```

Then replace the inline property loop inside `parseBaggage` (current lines 101-125, from `const properties: Array<BaggageProperty> = []` through `entries.push(entry)`) with:

```ts
    const properties = parseProperties(parts.slice(1))
    const entry: BaggageEntry = { key, value }
    if (properties.length > 0) {
      entry.properties = properties
    }
    seen.add(key)
    entries.push(entry)
```

- [ ] **Step 4: Add `baggageToEntries`**

At the top of `packages/otel/src/baggage.ts`, add the OTel type import (keep the existing `logger` import):

```ts
import type { Baggage } from '@opentelemetry/api'
```

Add at the end of the file:

```ts
/**
 * Convert an OpenTelemetry `Baggage` into enkaku `BaggageEntry` records. OTel
 * collapses the W3C property tail into one opaque per-entry metadata string; we
 * parse it back into structured `properties` with the same grammar as
 * `parseBaggage`, so the result round-trips losslessly through `formatBaggage`
 * for W3C-conformant baggage. Malformed metadata segments are dropped (same
 * tolerance as `parseBaggage`).
 */
export function baggageToEntries(baggage: Baggage): Array<BaggageEntry> {
  return baggage.getAllEntries().map(([key, e]) => {
    const entry: BaggageEntry = { key, value: e.value }
    if (e.metadata != null) {
      const properties = parseProperties(e.metadata.toString().split(';'))
      if (properties.length > 0) {
        entry.properties = properties
      }
    }
    return entry
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @enkaku/otel run test:unit -- baggage.test.ts`
Expected: PASS — all `baggageToEntries` tests, plus existing `parseBaggage`/`formatBaggage` tests still green (refactor preserved behavior).

- [ ] **Step 6: Export `baggageToEntries` from the package entry**

In `packages/otel/src/index.ts`, update the baggage export block (lines 10-15) to add `baggageToEntries`:

```ts
export {
  type BaggageEntry,
  type BaggageProperty,
  baggageToEntries,
  formatBaggage,
  parseBaggage,
} from './baggage.js'
```

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm --filter @enkaku/otel run test` then `rtk proxy pnpm run lint`
Expected: no type errors; lint clean.

- [ ] **Step 8: Commit**

```bash
git add packages/otel/src/baggage.ts packages/otel/src/index.ts packages/otel/test/baggage.test.ts
git commit -m "feat(otel): baggageToEntries mapper + shared parseProperties

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `@enkaku/otel` — `getActiveBaggage()` accessor

Builds on Task 2's `baggageToEntries`. Thin accessor reading active context.

**Files:**
- Modify: `packages/otel/src/tracers.ts` (add import + `getActiveBaggage`)
- Modify: `packages/otel/src/index.ts` (export `getActiveBaggage`)
- Test: `packages/otel/test/tracers.test.ts` (append a `describe` block)

- [ ] **Step 1: Write the failing test**

In `packages/otel/test/tracers.test.ts`, update the import (lines 3-9) to add `getActiveBaggage`:

```ts
import {
  createTracer,
  getActiveBaggage,
  getActiveSpan,
  getActiveTraceContext,
  withSpan,
  withSyncSpan,
} from '../src/tracers.js'
```

Append:

```ts
describe('getActiveBaggage', () => {
  test('returns undefined when no baggage is active', () => {
    // No ContextManager is registered in tests, so the active context is ROOT
    // (empty). This is also the real-world "no SDK / no baggage" case.
    expect(getActiveBaggage()).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/otel run test:unit -- tracers.test.ts`
Expected: FAIL — `getActiveBaggage` is not exported from `tracers.js`.

> Note on test depth: with no `ContextManager` registered, `context.with(...)` does not make a context active (the default no-op manager always reports ROOT), so the active-baggage *read path* can only be exercised for the empty case here. The lossless *mapping* is fully covered by Task 2's `baggageToEntries` tests against a directly-constructed `Baggage`. `getActiveBaggage` is a thin delegation over that mapper.

- [ ] **Step 3: Add `getActiveBaggage`**

In `packages/otel/src/tracers.ts`, update the value import on line 2 to add `propagation`, and import the mapper + type from `baggage.js`:

```ts
import { context, type Span, SpanStatusCode, propagation, trace } from '@opentelemetry/api'

import { type BaggageEntry, baggageToEntries } from './baggage.js'
import { ZERO_TRACE_ID } from './semantic.js'
```

Add after `getActiveTraceContext` (after line 37):

```ts
export function getActiveBaggage(): Array<BaggageEntry> | undefined {
  const baggage = propagation.getActiveBaggage()
  if (baggage == null) {
    return undefined
  }
  const entries = baggageToEntries(baggage)
  return entries.length === 0 ? undefined : entries
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/otel run test:unit -- tracers.test.ts`
Expected: PASS.

- [ ] **Step 5: Export `getActiveBaggage` from the package entry**

In `packages/otel/src/index.ts`, update the tracers export block (lines 26-33) to add `getActiveBaggage`:

```ts
export {
  createTracer,
  getActiveBaggage,
  getActiveSpan,
  getActiveTraceContext,
  type TraceContext,
  withSpan,
  withSyncSpan,
} from './tracers.js'
```

- [ ] **Step 6: Full package test + lint**

Run: `pnpm --filter @enkaku/otel run test` then `rtk proxy pnpm run lint`
Expected: no type errors; lint clean.

- [ ] **Step 7: Commit**

```bash
git add packages/otel/src/tracers.ts packages/otel/src/index.ts packages/otel/test/tracers.test.ts
git commit -m "feat(otel): getActiveBaggage accessor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Step 1: Run both package test suites**

Run: `pnpm --filter @enkaku/otel --filter @enkaku/schema run test`
Expected: all pass (type checks + unit).

- [ ] **Step 2: Lint whole workspace**

Run: `rtk proxy pnpm run lint`
Expected: clean.

---

## Out of scope (handled by user)

- Version bumps + publishing `@enkaku/otel` / `@enkaku/schema`.
- Mokei-side consumption (G5 baggage population, G8 strict opt-in).
