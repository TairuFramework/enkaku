# OTel Per-Repo Span Namespacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OTel spans/attributes carry the prefix of the repo that emits them (`enkaku.*`, `kokuin.*`) instead of all being mislabeled `sozai.*`.

**Architecture:** `@sozai/otel` becomes pure instrumentation infra (no domain names) and exposes `createTracerFactory(prefix)`. Each downstream repo gets its own otel package (`@enkaku/otel`, `@kokuin/otel`) that owns its `SpanNames`/`AttributeKeys` and a prefixed `createTracer`. Consumers import infra functions from `@sozai/otel` and names from their local otel package. Rolled out via published npm in dependency order: sozai → kokuin → enkaku.

**Tech Stack:** TypeScript, pnpm workspaces (catalog cross-repo deps), swc + tsc build, vitest, OpenTelemetry API + SDK, changesets, biome.

## Global Constraints

- **Three separate git repos**, executed in order: `~/dev/yulsi/sozai`, then `~/dev/yulsi/kokuin`, then `~/dev/yulsi/enkaku`. Each phase ends with its repo green and published before the next phase consumes it.
- **Cross-repo deps use pnpm `catalog:`** (resolved from each repo's `pnpm-workspace.yaml` `catalog:` block, pointing at published registry versions). Same-repo deps use `workspace:^`.
- **Layer order (no cycles):** sozai (bottom) → kokuin → enkaku (top). `@sozai/otel` must never reference enkaku/kokuin domain names.
- **Ownership split (verbatim):**
  - `@sozai/otel` keeps only OTel-standard `AttributeKeys`: `RPC_PROCEDURE RPC_REQUEST_ID RPC_TYPE RPC_SYSTEM HTTP_METHOD HTTP_STATUS_CODE NET_PEER_NAME`. No `SpanNames`.
  - `@enkaku/otel` owns: SpanNames `CLIENT_* SERVER_* TRANSPORT_*`; AttributeKeys `AUTH_DID AUTH_ALLOWED AUTH_REASON TRANSPORT_TYPE TRANSPORT_SESSION_ID MESSAGE_DIRECTION STREAM_MESSAGE_INDEX CHANNEL_MESSAGE_INDEX VALIDATION_SUCCESS VALIDATION_ERROR ERROR_CODE ERROR_MESSAGE`.
  - `@kokuin/otel` owns: SpanNames `TOKEN_SIGN TOKEN_VERIFY KEYSTORE_GET_OR_CREATE`; AttributeKeys `AUTH_DID AUTH_ALGORITHM KEYSTORE_KEY_CREATED KEYSTORE_STORE_TYPE`.
- **Separate named exports:** downstream name tables are `EnkakuSpanNames`/`EnkakuAttributeKeys` and `KokuinSpanNames`/`KokuinAttributeKeys` (explicit provenance). `@sozai/otel` keeps the name `AttributeKeys` for its std table.
- **Naming/style (AGENTS.md):** `type` not `interface`; `ID`/`HTTP`/`JWT` casing; `Array<T>` not `T[]`; no `any`; `pnpm` only; never edit generated files (`lib/`, `*.gen.ts`).
- **Gate each repo (all exit 0):** `pnpm install` → `pnpm run build` → `pnpm run test` → lint (`rtk proxy pnpm run lint` in enkaku; `pnpm run lint` in sozai/kokuin if defined).
- **Publishing is irreversible + outward-facing** — every `pnpm publish` / `changeset publish` step requires explicit user authorization at execution time and valid npm credentials.

---

## Phase A — Refactor `@sozai/otel` (repo: `~/dev/yulsi/sozai`)

### Task A1: Strip domain names + add tracer factory

**Files:**
- Modify: `sozai/packages/otel/src/semantic.ts`
- Modify: `sozai/packages/otel/src/tracers.ts`
- Modify: `sozai/packages/otel/src/index.ts`
- Test: `sozai/packages/otel/test/semantic.test.ts`
- Test: `sozai/packages/otel/test/tracers.test.ts`

**Interfaces:**
- Produces: `createTracerFactory(prefix: string): (name: string) => Tracer` (exported from `@sozai/otel`). `AttributeKeys` reduced to the 7 std keys. `SpanNames` and `createTracer` no longer exported.

- [ ] **Step 1: Rewrite `semantic.test.ts` to the target shape**

Replace the entire file with:

```ts
import { describe, expect, test } from 'vitest'

import { AttributeKeys } from '../src/semantic.js'

describe('AttributeKeys', () => {
  test('has RPC attributes', () => {
    expect(AttributeKeys.RPC_PROCEDURE).toBe('rpc.procedure')
    expect(AttributeKeys.RPC_REQUEST_ID).toBe('rpc.request_id')
    expect(AttributeKeys.RPC_TYPE).toBe('rpc.type')
    expect(AttributeKeys.RPC_SYSTEM).toBe('rpc.system')
  })

  test('has HTTP attributes', () => {
    expect(AttributeKeys.HTTP_METHOD).toBe('http.method')
    expect(AttributeKeys.HTTP_STATUS_CODE).toBe('http.status_code')
  })

  test('has network attributes', () => {
    expect(AttributeKeys.NET_PEER_NAME).toBe('net.peer.name')
  })

  test('exposes no SpanNames export', async () => {
    const mod = await import('../src/semantic.js')
    expect('SpanNames' in mod).toBe(false)
  })

  test('exposes no domain attributes', () => {
    const keys = Object.keys(AttributeKeys)
    for (const k of keys) {
      expect(AttributeKeys[k as keyof typeof AttributeKeys]).not.toMatch(/^sozai\./)
    }
  })
})
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd ~/dev/yulsi/sozai && pnpm --filter @sozai/otel exec vitest run test/semantic.test.ts`
Expected: FAIL — `AttributeKeys` still contains `sozai.*` domain keys, so the "no domain attributes" test fails.

- [ ] **Step 3: Rewrite `semantic.ts`**

Replace the entire file with:

```ts
export const ZERO_TRACE_ID = '00000000000000000000000000000000'

export const AttributeKeys = {
  // RPC (OTel semantic conventions)
  RPC_PROCEDURE: 'rpc.procedure',
  RPC_REQUEST_ID: 'rpc.request_id',
  RPC_TYPE: 'rpc.type',
  RPC_SYSTEM: 'rpc.system',

  // HTTP (standard OTel)
  HTTP_METHOD: 'http.method',
  HTTP_STATUS_CODE: 'http.status_code',

  // Network
  NET_PEER_NAME: 'net.peer.name',
} as const
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd ~/dev/yulsi/sozai && pnpm --filter @sozai/otel exec vitest run test/semantic.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `tracers.ts` lines 7-11 (the factory)**

Replace:
```ts
const SOZAI_VERSION = '0.1.0'

export function createTracer(name: string): Tracer {
  return trace.getTracer(`sozai.${name}`, SOZAI_VERSION)
}
```
with:
```ts
const OTEL_PACKAGE_VERSION = '0.1.0'

export function createTracerFactory(prefix: string): (name: string) => Tracer {
  return (name: string): Tracer => trace.getTracer(`${prefix}.${name}`, OTEL_PACKAGE_VERSION)
}
```
Leave the rest of `tracers.ts` (`getActiveSpan`, `withSpan`, `withSyncSpan`, etc.) unchanged.

- [ ] **Step 6: Update `tracers.test.ts` to use the factory**

In `tracers.test.ts`, change the import line from `createTracer,` to `createTracerFactory,`, and add this line immediately after the import block:
```ts
const createTracer = createTracerFactory('test')
```
Replace the `describe('createTracer', ...)` block with:
```ts
describe('createTracerFactory', () => {
  test('returns a factory that produces a Tracer from the global TracerProvider', () => {
    const tracer = createTracerFactory('sozai')('test-module')
    expect(tracer).toBeDefined()
    // Without an SDK registered, this returns a no-op tracer
    expect(typeof tracer.startSpan).toBe('function')
    expect(typeof tracer.startActiveSpan).toBe('function')
  })
})
```
All other `createTracer('test')` calls in the file now resolve to the local `createTracerFactory('test')` alias — leave them as-is.

- [ ] **Step 7: Update `index.ts` exports**

In `sozai/packages/otel/src/index.ts`:
- Change `export { AttributeKeys, SpanNames, ZERO_TRACE_ID } from './semantic.js'` → `export { AttributeKeys, ZERO_TRACE_ID } from './semantic.js'`
- In the `./tracers.js` export block, replace `createTracer,` with `createTracerFactory,`

- [ ] **Step 8: Run the full otel package test + build**

Run: `cd ~/dev/yulsi/sozai && pnpm --filter @sozai/otel run test && pnpm --filter @sozai/otel run build`
Expected: both PASS (types + unit + build).

- [ ] **Step 9: Full repo gate**

Run: `cd ~/dev/yulsi/sozai && pnpm install && pnpm run build && pnpm run test && pnpm run lint`
Expected: all exit 0. (No in-repo consumers of `createTracer`/`SpanNames` outside the otel package — verified.)

- [ ] **Step 10: Changeset**

Run: `cd ~/dev/yulsi/sozai && pnpm changeset`
Select `@sozai/otel`, bump **minor** (pre-1.0 breaking: removed exports), summary "Move domain span/attribute names out of @sozai/otel; add createTracerFactory."

- [ ] **Step 11: Commit**

```bash
cd ~/dev/yulsi/sozai
git add -A
git commit -m "refactor(otel): strip domain names, add createTracerFactory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task A2: Version + publish `@sozai/otel`

**Files:** (changeset-managed version bumps)

- [ ] **Step 1: Version**

Run: `cd ~/dev/yulsi/sozai && pnpm changeset version`
Note the new `@sozai/otel` version written to `packages/otel/package.json` (expected `0.2.0`). Record it — kokuin/enkaku catalogs must point at it.

- [ ] **Step 2: Commit the version bump**

```bash
cd ~/dev/yulsi/sozai
git add -A
git commit -m "chore: version @sozai/otel"
```

- [ ] **Step 3: Publish (REQUIRES USER AUTHORIZATION — irreversible)**

Confirm with the user, then:
Run: `cd ~/dev/yulsi/sozai && pnpm run build && pnpm changeset publish`
Expected: `@sozai/otel@<new version>` published. Verify: `npm view @sozai/otel version` returns the new version.

---

## Phase B — `@kokuin/otel` + rewire kokuin (repo: `~/dev/yulsi/kokuin`)

### Task B1: Create the `@kokuin/otel` package

**Files:**
- Create: `kokuin/packages/otel/package.json`
- Create: `kokuin/packages/otel/tsconfig.json`
- Create: `kokuin/packages/otel/tsconfig.test.json`
- Create: `kokuin/packages/otel/src/index.ts`
- Test: `kokuin/packages/otel/test/semantic.test.ts`

**Interfaces:**
- Produces (from `@kokuin/otel`): `createTracer(name: string): Tracer`; `KokuinSpanNames` (`TOKEN_SIGN`,`TOKEN_VERIFY`,`KEYSTORE_GET_OR_CREATE`); `KokuinAttributeKeys` (`AUTH_DID`,`AUTH_ALGORITHM`,`KEYSTORE_KEY_CREATED`,`KEYSTORE_STORE_TYPE`).

- [ ] **Step 1: Bump the `@sozai/otel` catalog entry**

In `kokuin/pnpm-workspace.yaml` under `catalog:`, change `'@sozai/otel': ^0.1.0` → `'@sozai/otel': ^0.2.0` (use the version published in Task A2).

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "@kokuin/otel",
  "version": "0.1.0",
  "license": "MIT",
  "description": "Kokuin OpenTelemetry span and attribute names",
  "keywords": ["opentelemetry", "tracing", "kokuin"],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/kokuin",
    "directory": "packages/otel"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": { ".": "./lib/index.js" },
  "files": ["lib/*"],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../node_modules/@kigu/dev/swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit --skipLibCheck -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@sozai/otel": "catalog:",
    "@opentelemetry/api": "catalog:"
  },
  "publishConfig": { "access": "public" }
}
```

If `@opentelemetry/api` is not yet a key in `kokuin/pnpm-workspace.yaml` `catalog:`, add `'@opentelemetry/api': ^1.9.0` to it (the version `@sozai/otel` resolves against; align with sozai's catalog).

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "@kigu/dev/tsconfig.json",
  "compilerOptions": {
    "lib": ["es2025"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

- [ ] **Step 4: Write `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["./src/**/*", "./test/**/*"]
}
```

- [ ] **Step 5: Write the failing test `test/semantic.test.ts`**

```ts
import { describe, expect, test } from 'vitest'

import { KokuinAttributeKeys, KokuinSpanNames, createTracer } from '../src/index.js'

describe('KokuinSpanNames', () => {
  test('token + keystore span names are kokuin-prefixed', () => {
    expect(KokuinSpanNames.TOKEN_SIGN).toBe('kokuin.token.sign')
    expect(KokuinSpanNames.TOKEN_VERIFY).toBe('kokuin.token.verify')
    expect(KokuinSpanNames.KEYSTORE_GET_OR_CREATE).toBe('kokuin.keystore.get_or_create')
  })
})

describe('KokuinAttributeKeys', () => {
  test('auth + keystore attrs are kokuin-prefixed', () => {
    expect(KokuinAttributeKeys.AUTH_DID).toBe('kokuin.auth.did')
    expect(KokuinAttributeKeys.AUTH_ALGORITHM).toBe('kokuin.auth.algorithm')
    expect(KokuinAttributeKeys.KEYSTORE_KEY_CREATED).toBe('kokuin.keystore.key_created')
    expect(KokuinAttributeKeys.KEYSTORE_STORE_TYPE).toBe('kokuin.keystore.store_type')
  })
})

describe('createTracer', () => {
  test('returns a Tracer', () => {
    const tracer = createTracer('token')
    expect(typeof tracer.startSpan).toBe('function')
  })
})
```

- [ ] **Step 6: Run it, expect FAIL**

Run: `cd ~/dev/yulsi/kokuin && pnpm install && pnpm --filter @kokuin/otel exec vitest run`
Expected: FAIL — `../src/index.js` does not exist yet.

- [ ] **Step 7: Write `src/index.ts`**

```ts
import { createTracerFactory } from '@sozai/otel'

export const createTracer = createTracerFactory('kokuin')

export const KokuinSpanNames = {
  TOKEN_SIGN: 'kokuin.token.sign',
  TOKEN_VERIFY: 'kokuin.token.verify',
  KEYSTORE_GET_OR_CREATE: 'kokuin.keystore.get_or_create',
} as const

export const KokuinAttributeKeys = {
  AUTH_DID: 'kokuin.auth.did',
  AUTH_ALGORITHM: 'kokuin.auth.algorithm',
  KEYSTORE_KEY_CREATED: 'kokuin.keystore.key_created',
  KEYSTORE_STORE_TYPE: 'kokuin.keystore.store_type',
} as const
```

- [ ] **Step 8: Run test + build, expect PASS**

Run: `cd ~/dev/yulsi/kokuin && pnpm --filter @kokuin/otel run test && pnpm --filter @kokuin/otel run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd ~/dev/yulsi/kokuin
git add -A
git commit -m "feat(otel): add @kokuin/otel with kokuin-prefixed span/attr names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task B2: Rewire kokuin consumers to `@kokuin/otel`

**Files (modify each `.ts` + its `package.json`):**
- `kokuin/packages/token/src/token.ts`, `token/src/identity.ts`, `token/package.json`
- `kokuin/packages/deterministic/src/store.ts`, `deterministic/package.json`
- `kokuin/packages/browser/src/identity.ts`, `browser/package.json`
- `kokuin/packages/node/src/identity.ts`, `node/package.json`
- `kokuin/packages/electron/src/identity.ts`, `electron/package.json`
- `kokuin/packages/expo/src/identity.ts`, `expo/package.json`
- `kokuin/packages/ledger-device/src/provider.ts`, `ledger-device/package.json`

**Interfaces:**
- Consumes: `createTracer`, `KokuinSpanNames`, `KokuinAttributeKeys` from `@kokuin/otel`; `withSpan`/`withSyncSpan` from `@sozai/otel`.

Mechanical transformation (kokuin consumers use **only** domain keys — none of the std `RPC_*/HTTP_*/NET_*`):

1. **Split the import.** The current single line is one of:
   `import { AttributeKeys, createTracer, SpanNames, withSpan } from '@sozai/otel'`
   or (node/electron/expo) `import { AttributeKeys, createTracer, SpanNames, withSpan, withSyncSpan } from '@sozai/otel'`
   Replace with two lines, keeping only the `withSpan`/`withSyncSpan` actually used by that file:
   ```ts
   import { withSpan } from '@sozai/otel'            // + withSyncSpan where the file used it
   import { createTracer, KokuinAttributeKeys, KokuinSpanNames } from '@kokuin/otel'
   ```
2. **Rename references:** `SpanNames.` → `KokuinSpanNames.`; `AttributeKeys.` → `KokuinAttributeKeys.` (replace-all in file).
3. **Add the dep:** in that package's `package.json` `dependencies`, add `"@kokuin/otel": "workspace:^"`. Keep `@sozai/otel` (still used for `withSpan`).

- [ ] **Step 1: Apply the transformation to all 7 packages' source files**

Apply rules 1-2 to each file listed above.

- [ ] **Step 2: Add `@kokuin/otel` dep to all 7 package.json files** (rule 3).

- [ ] **Step 3: Verify no stale references remain**

Run:
```bash
cd ~/dev/yulsi/kokuin
grep -rn "SpanNames\b\|AttributeKeys\b" packages --include='*.ts' | grep -v node_modules | grep -v '/lib/' | grep -v 'packages/otel/' | grep -v 'Kokuin'
```
Expected: no output (every reference now `KokuinSpanNames`/`KokuinAttributeKeys`).

- [ ] **Step 4: Install + build + test**

Run: `cd ~/dev/yulsi/kokuin && pnpm install && pnpm run build && pnpm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/yulsi/kokuin
git add -A
git commit -m "refactor(otel): rewire kokuin packages to @kokuin/otel names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task B3: Add kokuin token otel test

**Files:**
- Create: `kokuin/packages/token/test/otel.test.ts`
- Modify: `kokuin/packages/token/package.json` (devDeps)
- Modify: `kokuin/pnpm-workspace.yaml` (catalog)

**Interfaces:**
- Consumes: token sign/verify API from `../src/index.js` (use the same entry the existing `token/test/*.test.ts` files import — `createSigningIdentity`/`signToken`/`verifyToken` or equivalent; confirm exact names from `token/src/index.ts` before writing).

- [ ] **Step 1: Add otel SDK catalog entries**

In `kokuin/pnpm-workspace.yaml` `catalog:`, add:
```yaml
  '@opentelemetry/sdk-trace-base': ^2.8.0
  '@opentelemetry/sdk-trace-node': ^2.8.0
```

- [ ] **Step 2: Add token devDeps**

In `kokuin/packages/token/package.json` `devDependencies`, add:
```json
"@opentelemetry/sdk-trace-base": "catalog:",
"@opentelemetry/sdk-trace-node": "catalog:"
```

- [ ] **Step 3: Write the failing test**

Mirror the provider setup from `enkaku/tests/integration/otel.test.ts`. Use the token sign + verify entry points actually exported by `@kokuin/token` (read `token/src/identity.ts`/`token.ts` for the exact function names — sign produces the `kokuin.token.sign` span, verify produces `kokuin.token.verify`).

```ts
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'

// Import the real sign/verify entry points from the package under test.
// Replace the names below with the actual exports from '../src/index.js'.
import { createSigningIdentity, signToken, verifyToken } from '../src/index.js'

let exporter: InMemorySpanExporter
let provider: NodeTracerProvider

beforeAll(() => {
  exporter = new InMemorySpanExporter()
  provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
  provider.register()
})
beforeEach(() => exporter.reset())
afterAll(async () => { await provider.shutdown() })

test('token sign + verify emit kokuin-prefixed spans with auth attrs', async () => {
  const identity = createSigningIdentity()
  const token = await signToken(identity, { sub: 'test' })
  await verifyToken(token)

  await provider.forceFlush()
  const spans = exporter.getFinishedSpans()
  const names = spans.map((s) => s.name)

  expect(names).toContain('kokuin.token.sign')
  expect(names).toContain('kokuin.token.verify')

  const signSpan = spans.find((s) => s.name === 'kokuin.token.sign')
  expect(signSpan?.attributes['kokuin.auth.did']).toBe(identity.id)
  expect(signSpan?.attributes['kokuin.auth.algorithm']).toBe('EdDSA')
})
```

- [ ] **Step 4: Run it, expect FAIL first (pre-install), then resolve deps**

Run: `cd ~/dev/yulsi/kokuin && pnpm install && pnpm --filter @kokuin/token exec vitest run test/otel.test.ts`
Expected: PASS (spans are already kokuin-prefixed after Task B2). If the function names don't match, fix the imports/calls to the real API and re-run. If it FAILS on span names, that's a real regression in B2 — fix before proceeding.

- [ ] **Step 5: Full repo gate**

Run: `cd ~/dev/yulsi/kokuin && pnpm install && pnpm run build && pnpm run test && pnpm run lint`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/yulsi/kokuin
git add -A
git commit -m "test(otel): assert kokuin-prefixed token spans

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task B4: Version + publish kokuin packages

- [ ] **Step 1: Changeset**

Run: `cd ~/dev/yulsi/kokuin && pnpm changeset`
Select `@kokuin/otel` (new) and the 7 rewired consumers (`token deterministic browser node electron expo ledger-device`); bump **minor** (span-name change is observable behavior). Summary: "Emit kokuin-prefixed OTel spans/attributes via new @kokuin/otel."

- [ ] **Step 2: Version + commit**

```bash
cd ~/dev/yulsi/kokuin
pnpm changeset version
git add -A
git commit -m "chore: version kokuin otel packages"
```
Record the new `@kokuin/*` versions — enkaku's catalog must point at them.

- [ ] **Step 3: Publish (REQUIRES USER AUTHORIZATION — irreversible)**

Confirm with the user, then:
Run: `cd ~/dev/yulsi/kokuin && pnpm run build && pnpm changeset publish`
Verify: `npm view @kokuin/otel version` returns the new version.

---

## Phase C — `@enkaku/otel` + rewire enkaku (repo: `~/dev/yulsi/enkaku`)

### Task C1: Create the `@enkaku/otel` package

**Files:**
- Create: `enkaku/packages/otel/package.json`
- Create: `enkaku/packages/otel/tsconfig.json`
- Create: `enkaku/packages/otel/tsconfig.test.json`
- Create: `enkaku/packages/otel/src/index.ts`
- Test: `enkaku/packages/otel/test/semantic.test.ts`

**Interfaces:**
- Produces (from `@enkaku/otel`): `createTracer(name: string): Tracer`; `EnkakuSpanNames` (`CLIENT_CALL CLIENT_RESPONSE SERVER_HANDLE SERVER_ACCESS_CONTROL SERVER_HANDLER TRANSPORT_WRITE TRANSPORT_HTTP_REQUEST TRANSPORT_HTTP_SSE_CONNECT TRANSPORT_WS_CONNECT TRANSPORT_WS_MESSAGE TRANSPORT_SOCKET_CONNECT`); `EnkakuAttributeKeys` (`AUTH_DID AUTH_ALLOWED AUTH_REASON TRANSPORT_TYPE TRANSPORT_SESSION_ID MESSAGE_DIRECTION STREAM_MESSAGE_INDEX CHANNEL_MESSAGE_INDEX VALIDATION_SUCCESS VALIDATION_ERROR ERROR_CODE ERROR_MESSAGE`).

- [ ] **Step 1: Bump `@sozai/otel` catalog entry**

In `enkaku/pnpm-workspace.yaml` `catalog:`, set `'@sozai/otel'` to `^0.2.0` (the version published in Task A2). If absent, add it.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "@enkaku/otel",
  "version": "0.18.0",
  "license": "MIT",
  "homepage": "https://enkaku.dev",
  "description": "Enkaku OpenTelemetry span and attribute names",
  "keywords": ["opentelemetry", "tracing", "rpc", "enkaku"],
  "repository": {
    "type": "git",
    "url": "https://github.com/TairuFramework/enkaku",
    "directory": "packages/otel"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "exports": { ".": "./lib/index.js" },
  "files": ["lib/*"],
  "sideEffects": false,
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../node_modules/@kigu/dev/swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  },
  "dependencies": {
    "@sozai/otel": "catalog:",
    "@opentelemetry/api": "catalog:"
  }
}
```
If `@opentelemetry/api` is not a catalog key in `enkaku/pnpm-workspace.yaml`, add it matching sozai's resolved version.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "@kigu/dev/tsconfig.json",
  "compilerOptions": {
    "lib": ["es2025"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

- [ ] **Step 4: Write `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["./src/**/*", "./test/**/*"]
}
```

- [ ] **Step 5: Write the failing test `test/semantic.test.ts`**

```ts
import { describe, expect, test } from 'vitest'

import { EnkakuAttributeKeys, EnkakuSpanNames, createTracer } from '../src/index.js'

describe('EnkakuSpanNames', () => {
  test('client/server/transport span names are enkaku-prefixed', () => {
    expect(EnkakuSpanNames.CLIENT_CALL).toBe('enkaku.client.call')
    expect(EnkakuSpanNames.SERVER_HANDLE).toBe('enkaku.server.handle')
    expect(EnkakuSpanNames.SERVER_HANDLER).toBe('enkaku.server.handler')
    expect(EnkakuSpanNames.TRANSPORT_HTTP_REQUEST).toBe('enkaku.transport.http.request')
    expect(EnkakuSpanNames.TRANSPORT_SOCKET_CONNECT).toBe('enkaku.transport.socket.connect')
  })
})

describe('EnkakuAttributeKeys', () => {
  test('domain attrs are enkaku-prefixed', () => {
    expect(EnkakuAttributeKeys.AUTH_DID).toBe('enkaku.auth.did')
    expect(EnkakuAttributeKeys.AUTH_ALLOWED).toBe('enkaku.auth.allowed')
    expect(EnkakuAttributeKeys.AUTH_REASON).toBe('enkaku.auth.reason')
    expect(EnkakuAttributeKeys.ERROR_CODE).toBe('enkaku.error.code')
    expect(EnkakuAttributeKeys.VALIDATION_SUCCESS).toBe('enkaku.validation.success')
  })
})

describe('createTracer', () => {
  test('returns a Tracer', () => {
    expect(typeof createTracer('client').startSpan).toBe('function')
  })
})
```

- [ ] **Step 6: Run it, expect FAIL**

Run: `cd ~/dev/yulsi/enkaku && pnpm install && pnpm --filter @enkaku/otel exec vitest run`
Expected: FAIL — `../src/index.js` missing.

- [ ] **Step 7: Write `src/index.ts`**

```ts
import { createTracerFactory } from '@sozai/otel'

export const createTracer = createTracerFactory('enkaku')

export const EnkakuSpanNames = {
  CLIENT_CALL: 'enkaku.client.call',
  CLIENT_RESPONSE: 'enkaku.client.response',
  SERVER_HANDLE: 'enkaku.server.handle',
  SERVER_ACCESS_CONTROL: 'enkaku.server.access_control',
  SERVER_HANDLER: 'enkaku.server.handler',
  TRANSPORT_WRITE: 'enkaku.transport.write',
  TRANSPORT_HTTP_REQUEST: 'enkaku.transport.http.request',
  TRANSPORT_HTTP_SSE_CONNECT: 'enkaku.transport.http.sse_connect',
  TRANSPORT_WS_CONNECT: 'enkaku.transport.ws.connect',
  TRANSPORT_WS_MESSAGE: 'enkaku.transport.ws.message',
  TRANSPORT_SOCKET_CONNECT: 'enkaku.transport.socket.connect',
} as const

export const EnkakuAttributeKeys = {
  AUTH_DID: 'enkaku.auth.did',
  AUTH_ALLOWED: 'enkaku.auth.allowed',
  AUTH_REASON: 'enkaku.auth.reason',
  TRANSPORT_TYPE: 'enkaku.transport.type',
  TRANSPORT_SESSION_ID: 'enkaku.transport.session_id',
  MESSAGE_DIRECTION: 'enkaku.message.direction',
  STREAM_MESSAGE_INDEX: 'enkaku.stream.message_index',
  CHANNEL_MESSAGE_INDEX: 'enkaku.channel.message_index',
  VALIDATION_SUCCESS: 'enkaku.validation.success',
  VALIDATION_ERROR: 'enkaku.validation.error',
  ERROR_CODE: 'enkaku.error.code',
  ERROR_MESSAGE: 'enkaku.error.message',
} as const
```

- [ ] **Step 8: Run test + build, expect PASS**

Run: `cd ~/dev/yulsi/enkaku && pnpm --filter @enkaku/otel run test && pnpm --filter @enkaku/otel run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
cd ~/dev/yulsi/enkaku
git add -A
git commit -m "feat(otel): add @enkaku/otel with enkaku-prefixed span/attr names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C2: Rewire enkaku consumers to `@enkaku/otel`

**Files (modify each `.ts` + its `package.json`):**
- `enkaku/packages/client/src/client.ts`, `client/package.json`
- `enkaku/packages/server/src/server.ts`, `server/package.json`
- `enkaku/packages/http-fetch/src/index.ts`, `http-fetch/package.json`
- `enkaku/packages/http-serve/src/index.ts`, `http-serve/package.json`
- `enkaku/packages/socket/src/index.ts`, `socket/package.json`

**Interfaces:**
- Consumes: `createTracer`, `EnkakuSpanNames`, `EnkakuAttributeKeys` from `@enkaku/otel`; `withSpan`/`getActiveSpan`/`AttributeKeys` (std only) + types from `@sozai/otel`.

**Key-routing table** — when rewriting `AttributeKeys.X`:

| Goes to `EnkakuAttributeKeys` (from `@enkaku/otel`) | Stays `AttributeKeys` (from `@sozai/otel`) |
|---|---|
| `AUTH_DID AUTH_ALLOWED AUTH_REASON TRANSPORT_TYPE TRANSPORT_SESSION_ID MESSAGE_DIRECTION STREAM_MESSAGE_INDEX CHANNEL_MESSAGE_INDEX VALIDATION_SUCCESS VALIDATION_ERROR ERROR_CODE ERROR_MESSAGE` | `RPC_PROCEDURE RPC_REQUEST_ID RPC_TYPE RPC_SYSTEM HTTP_METHOD HTTP_STATUS_CODE NET_PEER_NAME` |

All `SpanNames.X` → `EnkakuSpanNames.X`. `createTracer` import moves to `@enkaku/otel`.

Transformation per file:
1. **Imports.** In the `@sozai/otel` import, remove `createTracer` and `SpanNames`; keep `AttributeKeys` (std still used), `withSpan`, `getActiveSpan`, `withActiveBaggage`, type imports, etc. — whatever that file already used minus the two moved names. Add a new import:
   ```ts
   import { createTracer, EnkakuAttributeKeys, EnkakuSpanNames } from '@enkaku/otel'
   ```
   (For `socket/src/index.ts`, the current single line `import { AttributeKeys, createTracer, SpanNames, withSpan } from '@sozai/otel'` becomes:
   ```ts
   import { AttributeKeys, withSpan } from '@sozai/otel'
   import { createTracer, EnkakuAttributeKeys, EnkakuSpanNames } from '@enkaku/otel'
   ```
   — `socket` uses std `NET_PEER_NAME` so it keeps `AttributeKeys`.)
2. **References.** `SpanNames.` → `EnkakuSpanNames.` (replace-all). For `AttributeKeys.`, rename **only** the domain keys in the left column to `EnkakuAttributeKeys.`; leave std keys (right column) as `AttributeKeys.`.
3. **Dep.** Add `"@enkaku/otel": "workspace:^"` to that package's `package.json` `dependencies`. Keep `@sozai/otel`.

- [ ] **Step 1: Rewire `socket/src/index.ts`** (smallest — uses `NET_PEER_NAME` std + `TRANSPORT_SOCKET_CONNECT` + `TRANSPORT_TYPE`). Apply rules 1-2.

- [ ] **Step 2: Rewire `http-fetch/src/index.ts`** (std `HTTP_METHOD`/`HTTP_STATUS_CODE`; domain `TRANSPORT_TYPE`/`TRANSPORT_SESSION_ID`; SpanNames `TRANSPORT_HTTP_REQUEST`/`TRANSPORT_HTTP_SSE_CONNECT`).

- [ ] **Step 3: Rewire `http-serve/src/index.ts`** (std `HTTP_METHOD`/`HTTP_STATUS_CODE`; domain `TRANSPORT_TYPE`; SpanName `TRANSPORT_HTTP_REQUEST`).

- [ ] **Step 4: Rewire `client/src/client.ts`** (std `RPC_*`; domain `ERROR_*`/`MESSAGE_DIRECTION`; SpanName `CLIENT_CALL`).

- [ ] **Step 5: Rewire `server/src/server.ts`** (std `RPC_*`; domain `VALIDATION_*`/`AUTH_*`/`ERROR_*`; SpanNames `SERVER_HANDLE`/`SERVER_HANDLER`).

- [ ] **Step 6: Add `@enkaku/otel` dep to all 5 package.json files** (rule 3).

- [ ] **Step 7: Verify routing correctness**

Run:
```bash
cd ~/dev/yulsi/enkaku
# No bare SpanNames left, and no domain AttributeKeys left referencing @sozai table:
grep -rn "\bSpanNames\." packages/client packages/server packages/http-fetch packages/http-serve packages/socket --include='*.ts' | grep -v 'Enkaku'
grep -rnE "\bAttributeKeys\.(AUTH_|TRANSPORT_TYPE|TRANSPORT_SESSION_ID|MESSAGE_DIRECTION|STREAM_MESSAGE_INDEX|CHANNEL_MESSAGE_INDEX|VALIDATION_|ERROR_)" packages/client packages/server packages/http-fetch packages/http-serve packages/socket --include='*.ts'
```
Expected: both print nothing. (First: all span names are `EnkakuSpanNames`. Second: no domain key still routed through the std `AttributeKeys` table.)

- [ ] **Step 8: Install + build + unit tests**

Run: `cd ~/dev/yulsi/enkaku && pnpm install && pnpm run build && pnpm run test:unit`
Expected: PASS (the integration otel test is updated next; if it fails here on span names, that's expected until Task C3).

- [ ] **Step 9: Commit**

```bash
cd ~/dev/yulsi/enkaku
git add -A
git commit -m "refactor(otel): rewire enkaku packages to @enkaku/otel names

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C3: Update enkaku integration otel test

**Files:**
- Modify: `enkaku/tests/integration/otel.test.ts`

**Interfaces:**
- Consumes: emitted span names `enkaku.client.call`, `enkaku.server.handle`, `kokuin.token.sign`; attrs `enkaku.auth.did`, `enkaku.auth.allowed`.

- [ ] **Step 1: Bump kokuin catalog entries (if pinned) in enkaku**

If `enkaku/pnpm-workspace.yaml` `catalog:` pins `@kokuin/token`/`@kokuin/capability`, set them to the versions published in Task B4. Run `pnpm install`.

- [ ] **Step 2: Edit the token-span assertion**

In `enkaku/tests/integration/otel.test.ts`, change line 89:
```ts
    // Should have token sign span (client signs the message)
    expect(spanNames).toContain('enkaku.token.sign')
```
to:
```ts
    // Token signing happens in @kokuin/token and joins the same trace
    expect(spanNames).toContain('kokuin.token.sign')
```
Leave the `enkaku.client.call` (line 87), `enkaku.server.handle` (line 91), trace-ID propagation (lines 94-98), and `enkaku.auth.did`/`enkaku.auth.allowed` (lines 145-146) assertions unchanged.

- [ ] **Step 3: Run the integration test, expect PASS**

Run: `cd ~/dev/yulsi/enkaku && pnpm run -C tests/integration test:unit`
Expected: both tests in `otel.test.ts` PASS. The `console.log('spanNames', ...)` should now show `enkaku.*` and `kokuin.token.*` entries.

- [ ] **Step 4: Remove the debug console.log**

Delete line 84 (`console.log('spanNames', spanNames)`) — it was a debugging aid.

- [ ] **Step 5: Full repo gate**

Run: `cd ~/dev/yulsi/enkaku && pnpm install && pnpm run build && pnpm run test && rtk proxy pnpm run lint`
Expected: all exit 0.

- [ ] **Step 6: Changeset + commit**

Run: `cd ~/dev/yulsi/enkaku && pnpm changeset`
Select `@enkaku/otel` (new) + the 5 rewired consumers (`client server http-fetch http-serve socket`); bump **minor**. Summary: "Emit enkaku-prefixed OTel spans/attributes via new @enkaku/otel."
```bash
cd ~/dev/yulsi/enkaku
git add -A
git commit -m "test(otel): assert enkaku-prefixed spans + cross-pkg kokuin.token.sign

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Publish enkaku packages (OPTIONAL — REQUIRES USER AUTHORIZATION)**

Only if a release is wanted now. Confirm with the user, then:
```bash
cd ~/dev/yulsi/enkaku
pnpm changeset version && git add -A && git commit -m "chore: version enkaku otel packages"
pnpm run build && pnpm changeset publish
```

---

## Self-Review

**Spec coverage:**
- Component 1 (`@sozai/otel` refactor: factory + std-only attrs + drop SpanNames) → Task A1. ✓
- Component 2 (`@enkaku/otel` + rewire 5 consumers) → Tasks C1, C2. ✓
- Component 3 (`@kokuin/otel` + rewire 7 consumers) → Tasks B1, B2. ✓
- Component 4 (enkaku test split + kokuin token test) → Tasks C3, B3. ✓
- Rollout (published npm, sozai→kokuin→enkaku, catalog bumps) → Tasks A2, B1/B4, C1/C3. ✓
- Success criteria (enkaku.*/kokuin.* spans, no sozai.* domain, tests green) → C3 gate + B3 + A1. ✓

**Placeholder scan:** No TBD/TODO. The only deliberate "confirm exact names" is in Task B3 (kokuin token sign/verify export names) — flagged because the public API of `@kokuin/token` must be read at execution; the test body is otherwise complete and the fallback (fix imports to real API) is stated.

**Type/name consistency:** `createTracerFactory(prefix)` defined in A1, consumed in B1/C1. `EnkakuSpanNames`/`EnkakuAttributeKeys`/`KokuinSpanNames`/`KokuinAttributeKeys` names consistent across producer tasks (B1/C1) and consumer tasks (B2/C2) and tests (B3/C3). Std `AttributeKeys` table (RPC/HTTP/NET) consistent between A1 (definition) and C2 routing table.

**Version note:** exact published versions (`@sozai/otel` 0.2.0, kokuin/enkaku bumps) are computed by `changeset version`; catalog-bump steps say to use the actually-published version rather than a hardcoded guess.
