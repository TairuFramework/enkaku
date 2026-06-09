# JSON Schema 2020-12 support in `@enkaku/schema` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `{ draft?: '07' | '2020-12' }` option to `@enkaku/schema`'s validator factories so callers can validate JSON Schema 2020-12 schemas, with draft-07 remaining the default for all existing consumers.

**Architecture:** Replace the single module-level AJV instance with a lazily-constructed, cached instance **per draft** (`'07'` → `Ajv`, `'2020-12'` → `Ajv2020`), keyed in a `Map`. `createValidator`/`createStandardValidator` gain an optional `ValidatorOptions` argument selecting the draft; compile + `removeSchema($id)` run on the resolved instance. No consumer changes.

**Tech Stack:** TypeScript, Vitest, `ajv` 8.20 (`Ajv` + `Ajv2020` from `ajv/dist/2020`, base type from `ajv/dist/core`), `ajv-formats`, `json-schema-to-ts`. Package manager: `pnpm`. Lint: `rtk proxy pnpm run lint`.

**Reference:** Spec at `docs/superpowers/specs/2026-06-09-schema-json-schema-2020-12-design.md`.

**Conventions (from AGENTS.md — do not violate):**
- `type` not `interface`; `Array<T>` not `T[]`; no `any`.
- Names: uppercase initialisms.
- Use `pnpm`, never `npm`/`npx`.

**Pre-verified facts (already confirmed against the installed deps — trust these):**
- `ajv/dist/2020.d.ts` exists and `export default Ajv2020`; `import Ajv2020 from 'ajv/dist/2020'` resolves under `nodenext`.
- `ajv/dist/core` default-exports the base `Ajv` class that both `Ajv` and `Ajv2020` extend — use it as the `Map`/return type so both instances assign.
- A `prefixItems` schema with `as const` type-checks against the `Schema` type and `FromSchema`.
- Under the existing config (`new Ajv({ allErrors: true, useDefaults: false })`, strict mode on by default), compiling a `prefixItems` schema **throws** `strict mode: unknown keyword: "prefixItems"`. Under `Ajv2020` it validates correctly.

**Test command (run from repo root):**
```bash
pnpm --filter @enkaku/schema exec vitest run test/lib.test.ts
```

---

## File Structure

- `packages/schema/src/validation.ts` (modify) — per-draft instance cache + `ValidatorOptions` + optional `options` arg on both factories. Sole behavioral change.
- `packages/schema/src/index.ts` (modify) — export `ValidatorOptions`.
- `packages/schema/test/lib.test.ts` (modify) — add 2020-12 + regression + formats tests.

---

## Task 1: Per-draft instances + `{ draft }` option

**Files:**
- Modify: `packages/schema/src/validation.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/test/lib.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/schema/test/lib.test.ts`, add a new `describe` block (anywhere after the existing imports — the file already imports `createValidator`, `assertType`, `isType`, `ValidationError` from `../src/index.js`; also add `createStandardValidator` to that import if not already present — it is already imported):

```ts
describe('JSON Schema 2020-12 support', () => {
  test('validates a 2020-12 prefixItems tuple with { draft: "2020-12" }', () => {
    const validator = createValidator(
      {
        $id: 'tuple2020',
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        items: false,
      } as const,
      { draft: '2020-12' },
    )
    expect(isType(validator, [1, 'a'])).toBe(true)
    expect(isType(validator, ['a', 1])).toBe(false)
    expect(isType(validator, [1, 'a', 'extra'])).toBe(false)
  })

  test('applies ajv-formats under the 2020-12 draft', () => {
    const validator = createValidator(
      { $id: 'email2020', type: 'string', format: 'email' } as const,
      { draft: '2020-12' },
    )
    expect(isType(validator, 'user@example.com')).toBe(true)
    expect(isType(validator, 'not-an-email')).toBe(false)
  })

  test('the default draft (07) still rejects 2020-12 keywords as before', () => {
    expect(() =>
      createValidator({
        $id: 'tuple07',
        type: 'array',
        prefixItems: [{ type: 'number' }, { type: 'string' }],
        items: false,
      } as const),
    ).toThrow(/unknown keyword/)
  })

  test('createStandardValidator forwards the draft option', () => {
    const standard = createStandardValidator(
      {
        $id: 'tupleStandard2020',
        type: 'array',
        prefixItems: [{ type: 'number' }],
        items: false,
      } as const,
      { draft: '2020-12' },
    )
    const ok = standard['~standard'].validate([1])
    const bad = standard['~standard'].validate(['x'])
    expect(ok).toEqual({ value: [1] })
    expect(bad).toBeInstanceOf(ValidationError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/schema exec vitest run test/lib.test.ts`
Expected: the two `{ draft: '2020-12' }` tests FAIL — `createValidator` ignores the second argument and uses the draft-07 instance, so the `prefixItems` schema throws `unknown keyword` instead of validating. (The default-draft `.toThrow` test passes already; that is intentional — it guards the unchanged default.)

- [ ] **Step 3: Replace the instance setup in `validation.ts`**

Open `packages/schema/src/validation.ts`. Replace the top of the file — the import block and the single `const ajv = ...` / `addFormats(ajv)` lines — with:

```ts
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type AjvCore from 'ajv/dist/core'
import { Ajv } from 'ajv'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import type { FromSchema } from 'json-schema-to-ts'

import { ValidationError } from './errors.js'
import type { Schema } from './types.js'

/**
 * Options for creating a validator.
 */
export type ValidatorOptions = { draft?: '07' | '2020-12' }

// AJV instances are locked to a single dialect, so we cache one instance per
// draft and construct them lazily.
const instances = new Map<'07' | '2020-12', AjvCore>()

function getAjv(draft: '07' | '2020-12'): AjvCore {
  let instance = instances.get(draft)
  if (instance == null) {
    const options = { allErrors: true, useDefaults: false }
    instance = draft === '2020-12' ? new Ajv2020(options) : new Ajv(options)
    // @ts-expect-error missing type definition
    addFormats(instance)
    instances.set(draft, instance)
  }
  return instance
}
```

Note: keep the `// @ts-expect-error missing type definition` directive (it suppresses the same `addFormats` typing gap as before). If `tsc` later reports the directive is unused, remove that one line.

- [ ] **Step 4: Thread `options` through the factories**

In the same file, change `createValidator` to resolve the instance from the option (default `'07'`):

```ts
export function createValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): Validator<T> {
  const ajv = getAjv(options?.draft ?? '07')
  const check = ajv.compile(schema)
  // Remove from AJV's internal cache
  ajv.removeSchema(schema.$id)

  return (value: unknown) => {
    return check(value) ? { value: value as T } : new ValidationError(schema, value, check.errors)
  }
}
```

And forward `options` from `createStandardValidator`:

```ts
export function createStandardValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): StandardSchemaV1<T> {
  return toStandardValidator(createValidator(schema, options))
}
```

Leave `assertType`, `asType`, `isType`, `toStandardValidator`, and the `Validator` type unchanged.

- [ ] **Step 5: Export `ValidatorOptions`**

In `packages/schema/src/index.ts`, add `type ValidatorOptions` to the existing export block from `./validation.js`:

```ts
export {
  assertType,
  asType,
  createStandardValidator,
  createValidator,
  isType,
  toStandardValidator,
  type Validator,
  type ValidatorOptions,
} from './validation.js'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/schema exec vitest run test/lib.test.ts`
Expected: PASS — all new tests plus all pre-existing tests green.

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @enkaku/schema run test:types`
Expected: PASS — no type errors and no unused `@ts-expect-error` (if the directive is reported unused, remove the single line noted in Step 3 and re-run).

- [ ] **Step 8: Commit**

```bash
git add packages/schema/src/validation.ts packages/schema/src/index.ts packages/schema/test/lib.test.ts
git commit -m "feat(schema): opt-in JSON Schema 2020-12 validation"
```

---

## Task 2: Full verification

- [ ] **Step 1: Run the full schema package test suite**

Run: `pnpm --filter @enkaku/schema run test`
Expected: PASS — type checks + all unit tests (existing + new) green.

- [ ] **Step 2: Confirm no consumer regressions**

The default draft is unchanged, so dependent packages are unaffected, but verify the dependents that build validators still type-check and test:

Run: `pnpm --filter @enkaku/token --filter @enkaku/server --filter @enkaku/hub-tunnel run test`
Expected: PASS — these packages call `createValidator`/`createStandardValidator` without an `options` argument, so they keep the draft-07 instance.

- [ ] **Step 3: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors. If files were reformatted, re-stage and amend:

```bash
git add -u && git commit --amend --no-edit
```

---

## Self-Review Notes

- **Spec coverage:** `ValidatorOptions` + optional arg on both factories (Task 1 Steps 3–5); per-draft lazy instance cache with `addFormats` on both (Step 3); `removeSchema($id)` on resolved instance (Step 4); export (Step 5); acceptance tests — 2020-12 prefixItems happy path, formats under 2020-12, default-draft regression guard, existing tests green (Steps 1, 6; Task 2). Error handling unchanged (still returns `ValidationError`; malformed schema throws at `compile`).
- **Type consistency:** `ValidatorOptions = { draft?: '07' | '2020-12' }` used identically in both factory signatures and the cache key; `AjvCore` is the cache value/return type.
- **No placeholders:** every code and test step contains full content.
