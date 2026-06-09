# Upstream ask: `@enkaku/schema` — JSON Schema 2020-12 support

**Filed by:** mokei MCP draft-migration work (`feat/mcp-spec-update`, item G8).
**Affected package:** `@enkaku/schema` (`packages/schema/src/validation.ts`).
**Status as of 2026-06-09:** blocking — mokei cannot implement G8 without this.

## Problem

`createValidator` compiles every schema with a single module-level AJV instance:

```ts
// packages/schema/src/validation.ts
import { Ajv } from 'ajv'
const ajv = new Ajv({ allErrors: true, useDefaults: false })
```

The default `ajv` import is the **JSON Schema draft-07** validator. JSON Schema
**2020-12** keywords (`prefixItems`, `$dynamicRef`, `$dynamicAnchor`,
`unevaluatedProperties`, `unevaluatedItems`, etc.) are unknown to it. In strict mode an
unknown keyword throws (`Error: strict mode: unknown keyword: "prefixItems"`); otherwise
they are silently ignored, so validation passes when it should constrain.

## Why mokei needs it

The MCP draft loosens tool `inputSchema`/`outputSchema` to **arbitrary JSON Schema
2020-12**, including `$ref` resolution and 2020-12-only keywords. mokei validates these
schemas through `@enkaku/schema`. With a draft-07 validator the loosened schemas either
fail to compile (strict) or validate incorrectly (lenient). mokei's G8 stays deferred
until `@enkaku/schema` can validate 2020-12.

## Proposed change

Switch the validator to the 2020-12 dialect, ideally without forcing every consumer onto
one dialect:

- **Minimal:** swap the import to `Ajv2020` (`import Ajv2020 from 'ajv/dist/2020'`) and
  construct the module-level instance from it. 2020-12 is backward-compatible with most
  draft-07 schemas in practice; verify the existing enkaku schema corpus still compiles.
- **Flexible (preferred):** let `createValidator` accept an options bag selecting the
  draft (`{ draft?: '07' | '2020-12' }`) or accept a caller-supplied AJV instance, so
  consumers opt into 2020-12 without changing the default for everyone. Keep the
  `removeSchema(schema.$id)` cache-eviction behavior intact.

## Acceptance

- A schema using `prefixItems` (or another 2020-12 keyword) compiles and validates
  correctly via `createValidator`.
- Existing enkaku packages' schemas continue to validate unchanged.
- `addFormats` continues to apply.

## Verification notes (2026-06-09)

Confirmed against `packages/schema/src/validation.ts` at enkaku `main`: single
module-level `new Ajv({ allErrors: true, useDefaults: false })`, `ajv.compile(schema)`,
no per-call draft option, no `Ajv2020`.
