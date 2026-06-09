# Design: JSON Schema 2020-12 support in `@enkaku/schema`

**Date:** 2026-06-09
**Ask:** [`2026-06-09-schema-json-schema-2020-12.md`](./2026-06-09-schema-json-schema-2020-12.md)
**Package:** `@enkaku/schema` (`packages/schema/src/validation.ts`)

## Goal

Let `createValidator` / `createStandardValidator` validate JSON Schema **2020-12**
schemas (e.g. `prefixItems`, `unevaluatedProperties`, `$dynamicRef`) on an opt-in basis,
without changing the dialect or behavior for the 30 existing consumers. Unblocks mokei's
MCP draft-migration item G8, which loosens tool `inputSchema`/`outputSchema` to arbitrary
2020-12.

## Decision

Add an opt-in `{ draft?: '07' | '2020-12' }` option. Default stays **draft-07**, so every
current consumer is byte-for-byte unchanged; mokei passes `{ draft: '2020-12' }`. A single
AJV instance is bound to one dialect, so we keep a lazily-constructed, cached instance per
draft.

(The corpus contains no array-form `items` tuples, so a global swap would likely be safe —
but opt-in is chosen to avoid silently changing the dialect for all consumers and to guard
against future strict-mode edge cases.)

## Scope

Changes confined to `packages/schema/src/validation.ts` plus its exports in
`packages/schema/src/index.ts` and tests in `packages/schema/test/lib.test.ts`. No change
to `types.ts`, `utils.ts`, or `errors.ts`. No consumer changes.

## API surface

```ts
export type ValidatorOptions = { draft?: '07' | '2020-12' }

export function createValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): Validator<T>

export function createStandardValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): StandardSchemaV1<T>
```

- `draft` defaults to `'07'`.
- `assertType` / `asType` / `isType` are unchanged — they take a `Validator`.
- `ValidatorOptions` is exported from the package entrypoint.

## Instance management

A single AJV instance is locked to one dialect, so instances are cached per draft and
constructed lazily (the 2020-12 instance is only built if a caller opts in):

```ts
import type { default as AjvCore } from 'ajv/dist/core'
import { Ajv } from 'ajv'
import Ajv2020 from 'ajv/dist/2020' // ajv 8.20 ships dist/2020; no exports map, path import resolves
import addFormats from 'ajv-formats'

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

- The `'07'` instance reproduces today's exact construction
  (`new Ajv({ allErrors: true, useDefaults: false })` + `addFormats`).
- `Ajv` and `Ajv2020` share the `ajv/dist/core` base type, used as the common map/return
  type so both assign cleanly. (The exact import spelling for the base type is an
  implementation detail; if `ajv/dist/core` proves awkward, a local union type alias is an
  acceptable fallback — behavior is unaffected.)
- `compile(schema)` and `removeSchema(schema.$id)` run on the **same** resolved instance,
  preserving the existing cache-eviction behavior.

`createValidator` becomes:

```ts
export function createValidator<S extends Schema, T = FromSchema<S>>(
  schema: S,
  options?: ValidatorOptions,
): Validator<T> {
  const ajv = getAjv(options?.draft ?? '07')
  const check = ajv.compile(schema)
  ajv.removeSchema(schema.$id)
  return (value: unknown) => {
    return check(value) ? { value: value as T } : new ValidationError(schema, value, check.errors)
  }
}
```

`createStandardValidator` forwards `options` to `createValidator`.

## Typing

`T = FromSchema<S>` is kept. `json-schema-to-ts` tolerates 2020-12 keywords (ignores
unknown ones for inference); the value 2020-12 adds here is **runtime** validation, not
compile-time typing. No change to the `Schema` type.

## Error handling

Unchanged. Failed validation returns `ValidationError(schema, value, check.errors)`. A
genuinely malformed 2020-12 schema throws at `compile` time — the same contract as
draft-07 today — so no new catch path is introduced.

## Testing

Additions to `packages/schema/test/lib.test.ts`:

1. **2020-12 happy path (acceptance):** `createValidator(schema, { draft: '2020-12' })` with
   a `prefixItems` tuple schema accepts a valid tuple and rejects an invalid one.
2. **Default-draft regression guard:** the same `prefixItems` schema under the default
   (draft-07) validator behaves as draft-07 does today (documents that the default is
   unchanged).
3. **Formats under 2020-12:** a `{ format: 'email' }` schema validated with
   `{ draft: '2020-12' }` rejects a non-email string, confirming `addFormats` applies.
4. Existing tests remain green (default path untouched).

## Acceptance

- A schema using `prefixItems` (or another 2020-12 keyword) compiles and validates
  correctly via `createValidator(schema, { draft: '2020-12' })`.
- Existing enkaku packages' schemas validate unchanged (default draft-07).
- `addFormats` continues to apply under both drafts.

## Decisions log

- **Selection mechanism:** opt-in `{ draft?: '07' | '2020-12' }`, default `'07'` — no
  behavior change for existing consumers. (Rejected: global swap to `Ajv2020`; rejected:
  caller-supplied AJV instance — YAGNI.)
- **Instance strategy:** lazily-constructed, cached instance per draft (AJV instances are
  single-dialect).
- **Typing:** keep `FromSchema<S>`; 2020-12 affects runtime validation, not inference.
