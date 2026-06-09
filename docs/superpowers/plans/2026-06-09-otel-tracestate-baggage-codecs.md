# `@enkaku/otel` tracestate + baggage codecs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure, unit-testable W3C `tracestate` and `baggage` header codecs to `@enkaku/otel`, mirroring the existing `traceparent` codec.

**Architecture:** Two standalone codec modules (`src/tracestate.ts`, `src/baggage.ts`), each exposing a `format*` and `parse*` function plus its entry types. Parse is lenient (drops malformed members, never throws). Format drops invalid members and warns via `@enkaku/log`'s `getEnkakuLogger('otel')`. Both are re-exported from `src/index.ts`. No changes to `context.ts`.

**Tech Stack:** TypeScript, Vitest, `@enkaku/log` (logtape), `@opentelemetry/api`. Package manager: `pnpm`. Lint: `rtk proxy pnpm run lint`.

**Reference:** Spec at `docs/superpowers/specs/2026-06-09-otel-tracestate-baggage-codecs-design.md`.

**Conventions (from AGENTS.md — do not violate):**
- `type` not `interface`; `Array<T>` not `T[]`; no `any`.
- Names: `ID` not `Id`, uppercase initialisms.
- Use `pnpm`, never `npm`/`npx`.

**Test command (run from repo root):**
```bash
pnpm --filter @enkaku/otel exec vitest run test/<file>.test.ts
```

---

## File Structure

- `packages/otel/src/tracestate.ts` (create) — tracestate codec + `TracestateEntry` type.
- `packages/otel/src/baggage.ts` (create) — baggage codec + `BaggageEntry`/`BaggageProperty` types.
- `packages/otel/test/tracestate.test.ts` (create) — tracestate tests.
- `packages/otel/test/baggage.test.ts` (create) — baggage tests.
- `packages/otel/src/index.ts` (modify) — add four re-exports.

---

## Task 1: `tracestate` codec

**Files:**
- Create: `packages/otel/src/tracestate.ts`
- Test: `packages/otel/test/tracestate.test.ts`
- Modify: `packages/otel/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/otel/test/tracestate.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { formatTracestate, parseTracestate } from '../src/tracestate.js'

describe('formatTracestate', () => {
  test('formats a single member', () => {
    expect(formatTracestate([{ key: 'rojo', value: '00f067aa0ba902b7' }])).toBe(
      'rojo=00f067aa0ba902b7',
    )
  })

  test('formats multiple members preserving order', () => {
    expect(
      formatTracestate([
        { key: 'rojo', value: '00f067aa0ba902b7' },
        { key: 'congo', value: 't61rcWkgMzE' },
      ]),
    ).toBe('rojo=00f067aa0ba902b7,congo=t61rcWkgMzE')
  })

  test('supports multi-tenant @ keys', () => {
    expect(formatTracestate([{ key: 'fw529a3039@dt', value: 'foo' }])).toBe('fw529a3039@dt=foo')
  })

  test('drops members with invalid key or value', () => {
    expect(
      formatTracestate([
        { key: 'OK', value: 'bad' }, // uppercase key invalid
        { key: 'good', value: 'has,comma' }, // comma invalid in value
        { key: 'keep', value: 'fine' },
      ]),
    ).toBe('keep=fine')
  })

  test('caps at 32 entries', () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, value: `v${i}` }))
    const result = formatTracestate(entries)
    expect(result.split(',')).toHaveLength(32)
  })
})

describe('parseTracestate', () => {
  test('parses a valid header', () => {
    expect(parseTracestate('rojo=00f067aa0ba902b7,congo=t61rcWkgMzE')).toEqual([
      { key: 'rojo', value: '00f067aa0ba902b7' },
      { key: 'congo', value: 't61rcWkgMzE' },
    ])
  })

  test('trims optional whitespace around members', () => {
    expect(parseTracestate('rojo=1, congo=2')).toEqual([
      { key: 'rojo', value: '1' },
      { key: 'congo', value: '2' },
    ])
  })

  test('drops malformed members, never throws', () => {
    expect(parseTracestate('rojo=1,garbage,=novalue,nokey,good=2')).toEqual([
      { key: 'rojo', value: '1' },
      { key: 'good', value: '2' },
    ])
  })

  test('keeps first occurrence of duplicate keys', () => {
    expect(parseTracestate('dup=first,dup=second')).toEqual([{ key: 'dup', value: 'first' }])
  })

  test('returns empty array for empty header', () => {
    expect(parseTracestate('')).toEqual([])
  })
})

describe('tracestate round-trip', () => {
  test('parse(format(x)) reproduces valid input', () => {
    const entries = [
      { key: 'rojo', value: '00f067aa0ba902b7' },
      { key: 'congo', value: 't61rcWkgMzE' },
    ]
    expect(parseTracestate(formatTracestate(entries))).toEqual(entries)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/otel exec vitest run test/tracestate.test.ts`
Expected: FAIL — cannot resolve `../src/tracestate.js` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/otel/src/tracestate.ts`:

```ts
import { getEnkakuLogger } from '@enkaku/log'

const logger = getEnkakuLogger('otel')

export type TracestateEntry = { key: string; value: string }

const MAX_ENTRIES = 32

// Key: simple-key (lcalpha then up to 255 of lcalpha/DIGIT/_-*/) or
// multi-tenant tenant@system form.
const KEY_REGEX =
  /^[a-z][a-z0-9_\-*/]{0,255}$|^[a-z0-9][a-z0-9_\-*/]{0,240}@[a-z][a-z0-9_\-*/]{0,13}$/
// Value: 1-256 chars from 0x20-0x7E excluding ',' (0x2C) and '=' (0x3D),
// last char must not be a space.
const VALUE_REGEX = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/

function isValidKey(key: string): boolean {
  return KEY_REGEX.test(key)
}

function isValidValue(value: string): boolean {
  return VALUE_REGEX.test(value)
}

/**
 * Format a W3C tracestate header value. Drops members with invalid keys or
 * values, caps at 32 entries, and preserves the given order. Never throws.
 */
export function formatTracestate(entries: Array<TracestateEntry>): string {
  const out: Array<string> = []
  for (const entry of entries) {
    if (out.length >= MAX_ENTRIES) {
      logger.warn('tracestate exceeds 32 entries, dropping {key}', { key: entry.key })
      continue
    }
    if (!isValidKey(entry.key) || !isValidValue(entry.value)) {
      logger.warn('dropping invalid tracestate member {key}', { key: entry.key })
      continue
    }
    out.push(`${entry.key}=${entry.value}`)
  }
  return out.join(',')
}

/**
 * Parse a W3C tracestate header value. Drops malformed members and duplicate
 * keys (keeping the first occurrence), caps at 32 entries. Never throws.
 */
export function parseTracestate(header: string): Array<TracestateEntry> {
  const entries: Array<TracestateEntry> = []
  const seen = new Set<string>()
  for (const member of header.split(',')) {
    const trimmed = member.trim()
    if (trimmed === '') {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (!isValidKey(key) || !isValidValue(value)) {
      continue
    }
    if (seen.has(key)) {
      continue
    }
    if (entries.length >= MAX_ENTRIES) {
      break
    }
    seen.add(key)
    entries.push({ key, value })
  }
  return entries
}
```

- [ ] **Step 4: Add the entrypoint export**

In `packages/otel/src/index.ts`, after the `formatTraceparent` export line, add:

```ts
export { formatTracestate, parseTracestate, type TracestateEntry } from './tracestate.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/otel exec vitest run test/tracestate.test.ts`
Expected: PASS — all tracestate tests green.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @enkaku/otel run test:types`
Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/otel/src/tracestate.ts packages/otel/test/tracestate.test.ts packages/otel/src/index.ts
git commit -m "feat(otel): add W3C tracestate codec"
```

---

## Task 2: `baggage` codec

**Files:**
- Create: `packages/otel/src/baggage.ts`
- Test: `packages/otel/test/baggage.test.ts`
- Modify: `packages/otel/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/otel/test/baggage.test.ts`:

```ts
import { describe, expect, test } from 'vitest'

import { formatBaggage, parseBaggage } from '../src/baggage.js'

describe('formatBaggage', () => {
  test('formats a single member', () => {
    expect(formatBaggage([{ key: 'userId', value: 'alice' }])).toBe('userId=alice')
  })

  test('formats multiple members preserving order', () => {
    expect(
      formatBaggage([
        { key: 'userId', value: 'alice' },
        { key: 'serverNode', value: 'DF28' },
      ]),
    ).toBe('userId=alice,serverNode=DF28')
  })

  test('percent-encodes values', () => {
    expect(formatBaggage([{ key: 'k', value: 'a b,c;d' }])).toBe('k=a%20b%2Cc%3Bd')
  })

  test('formats valueless and key=value properties', () => {
    expect(
      formatBaggage([
        { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
      ]),
    ).toBe('k=v;secure;ttl=30')
  })

  test('drops members with invalid (non-token) keys', () => {
    expect(
      formatBaggage([
        { key: 'bad key', value: 'v' },
        { key: 'good', value: 'v' },
      ]),
    ).toBe('good=v')
  })
})

describe('parseBaggage', () => {
  test('parses a valid header', () => {
    expect(parseBaggage('userId=alice,serverNode=DF28')).toEqual([
      { key: 'userId', value: 'alice' },
      { key: 'serverNode', value: 'DF28' },
    ])
  })

  test('percent-decodes values', () => {
    expect(parseBaggage('k=a%20b%2Cc%3Bd')).toEqual([{ key: 'k', value: 'a b,c;d' }])
  })

  test('parses valueless and key=value properties', () => {
    expect(parseBaggage('k=v;secure;ttl=30')).toEqual([
      { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
    ])
  })

  test('drops malformed members, never throws', () => {
    expect(parseBaggage('good=v,garbage,=novalue,bad key=x')).toEqual([{ key: 'good', value: 'v' }])
  })

  test('drops members with un-decodable percent sequences', () => {
    expect(parseBaggage('bad=%zz,good=v')).toEqual([{ key: 'good', value: 'v' }])
  })

  test('returns empty array for empty header', () => {
    expect(parseBaggage('')).toEqual([])
  })
})

describe('baggage round-trip', () => {
  test('parse(format(x)) reproduces values and properties', () => {
    const entries = [
      { key: 'userId', value: 'alice smith,jr' },
      { key: 'k', value: 'v', properties: [{ key: 'secure' }, { key: 'ttl', value: '30' }] },
    ]
    expect(parseBaggage(formatBaggage(entries))).toEqual(entries)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/otel exec vitest run test/baggage.test.ts`
Expected: FAIL — cannot resolve `../src/baggage.js` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `packages/otel/src/baggage.ts`:

```ts
import { getEnkakuLogger } from '@enkaku/log'

const logger = getEnkakuLogger('otel')

export type BaggageProperty = { key: string; value?: string }
export type BaggageEntry = { key: string; value: string; properties?: Array<BaggageProperty> }

// RFC 7230 token characters.
const TOKEN_REGEX = /^[a-zA-Z0-9!#$%&'*+\-.^_`|~]+$/

function isToken(key: string): boolean {
  return TOKEN_REGEX.test(key)
}

function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

/**
 * Format a W3C baggage header value. Percent-encodes values, drops members and
 * properties with invalid (non-token) keys, preserves order. No entry cap.
 * Never throws.
 */
export function formatBaggage(entries: Array<BaggageEntry>): string {
  const out: Array<string> = []
  for (const entry of entries) {
    if (!isToken(entry.key)) {
      logger.warn('dropping invalid baggage member {key}', { key: entry.key })
      continue
    }
    let member = `${entry.key}=${encodeURIComponent(entry.value)}`
    for (const prop of entry.properties ?? []) {
      if (!isToken(prop.key)) {
        logger.warn('dropping invalid baggage property {key}', { key: prop.key })
        continue
      }
      member +=
        prop.value === undefined
          ? `;${prop.key}`
          : `;${prop.key}=${encodeURIComponent(prop.value)}`
    }
    out.push(member)
  }
  return out.join(',')
}

/**
 * Parse a W3C baggage header value. Percent-decodes values, drops malformed
 * members and properties (including un-decodable percent sequences). Never
 * throws.
 */
export function parseBaggage(header: string): Array<BaggageEntry> {
  const entries: Array<BaggageEntry> = []
  for (const member of header.split(',')) {
    const parts = member.split(';')
    const kv = parts[0].trim()
    if (kv === '') {
      continue
    }
    const eq = kv.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = kv.slice(0, eq).trim()
    const rawValue = kv.slice(eq + 1).trim()
    if (!isToken(key)) {
      continue
    }
    const value = safeDecode(rawValue)
    if (value === undefined) {
      continue
    }
    const properties: Array<BaggageProperty> = []
    for (let i = 1; i < parts.length; i++) {
      const prop = parts[i].trim()
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
    const entry: BaggageEntry = { key, value }
    if (properties.length > 0) {
      entry.properties = properties
    }
    entries.push(entry)
  }
  return entries
}
```

- [ ] **Step 4: Add the entrypoint export**

In `packages/otel/src/index.ts`, after the `formatTracestate` export line added in Task 1, add:

```ts
export {
  type BaggageEntry,
  type BaggageProperty,
  formatBaggage,
  parseBaggage,
} from './baggage.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/otel exec vitest run test/baggage.test.ts`
Expected: PASS — all baggage tests green.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @enkaku/otel run test:types`
Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/otel/src/baggage.ts packages/otel/test/baggage.test.ts packages/otel/src/index.ts
git commit -m "feat(otel): add W3C baggage codec"
```

---

## Task 3: Full verification

- [ ] **Step 1: Run the full otel test suite**

Run: `pnpm --filter @enkaku/otel run test`
Expected: PASS — type checks + all unit tests (existing + new) green.

- [ ] **Step 2: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors; format applied. If files were reformatted, re-stage and amend the last commit:

```bash
git add -u && git commit --amend --no-edit
```

---

## Self-Review Notes

- **Spec coverage:** tracestate codec (Task 1), baggage codec (Task 2), entrypoint exports (Tasks 1 & 2 Step 4), round-trip / drop-not-throw / 32-cap / dup-key / percent-encoding / properties — all covered by tests. Warning channel via `getEnkakuLogger('otel')` implemented in both `format*` functions.
- **Type consistency:** `TracestateEntry`, `BaggageEntry`, `BaggageProperty` used identically across tasks and exports.
- **No placeholders:** every code and test step contains full content.
