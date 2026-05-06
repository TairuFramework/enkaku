# Access Control Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Enkaku's overloaded `accessControl` server option with a tightly-typed `accessRules` surface and add a DID-predicate allow variant with full message context.

**Architecture:** Server params switch to a discriminated union by `identity` presence (standalone vs authenticated). Per-procedure rules use a single `{ allow, encryption? }` config form where `allow` is `true | Array<string> | AllowPredicate`. Predicates receive an `AllowContext` (matched pattern, procedure, payload, server ID, bound `verifyDelegation` helper) so they can express any admission policy including sub-delegation.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, `@enkaku/capability` (`checkCapability`, `hasPartsMatch`).

**Spec:** `docs/superpowers/specs/2026-05-06-access-control-refactor-design.md`

**Branch:** `feat/access-control` (already checked out).

---

## Pre-flight

- [ ] **Confirm clean working tree on branch `feat/access-control`**

```bash
git status
```

Expected: branch `feat/access-control`, only the spec staged from prior commit (or already committed). No unrelated changes.

- [ ] **Confirm baseline tests pass**

```bash
pnpm install
pnpm run test
```

Expected: clean. Any pre-existing failure is unrelated noise — flag and stop.

---

## Task 1: Refactor `access-control.ts` types (no predicate yet)

**Files:**
- Modify: `packages/server/src/access-control.ts`
- Modify: `packages/server/src/server.ts` (rename imports only)

Rename the per-rule types and drop shorthand forms. Behavior unchanged; this task only restructures the type surface and the helper functions. Predicate variant added later.

- [ ] **Step 1: Replace types and helpers in `access-control.ts`**

Open `packages/server/src/access-control.ts`. Replace lines 9–32 (the type block plus `getAllowValue`/`getEncryptionPolicy`) with:

```ts
export type EncryptionPolicy = 'required' | 'optional' | 'none'

export type AccessRule = {
  allow: true | Array<string>
  encryption?: EncryptionPolicy
}

export type AccessRules = Record<string, AccessRule>
```

Note: `allow` does not include `false`. To deny a pattern, omit it from the record.

- [ ] **Step 2: Update `resolveEncryptionPolicy` signature and body**

Replace the existing `resolveEncryptionPolicy` (currently lines 34–50) with:

```ts
export function resolveEncryptionPolicy(
  procedure: string,
  rules: AccessRules | undefined,
  globalPolicy: EncryptionPolicy,
): EncryptionPolicy {
  if (rules != null) {
    for (const [pattern, rule] of Object.entries(rules)) {
      if (hasPartsMatch(procedure, pattern)) {
        if (rule.encryption != null) {
          return rule.encryption
        }
      }
    }
  }
  return globalPolicy
}
```

- [ ] **Step 3: Update `checkProcedureAccess` to consume `AccessRules`**

Replace the body (currently lines 60–108) with:

```ts
export async function checkProcedureAccess(
  serverID: string,
  rules: AccessRules,
  token: SignedToken<ProcedureAccessPayload>,
  options?: DelegationChainOptions,
): Promise<void> {
  const payload = token.payload
  if (payload.prc == null) {
    throw new Error('No procedure to check')
  }

  for (const [pattern, rule] of Object.entries(rules)) {
    if (!hasPartsMatch(payload.prc, pattern)) continue

    const { allow } = rule

    if (allow === true) {
      return
    }

    // allow is Array<string>
    if (allow.includes(payload.iss)) {
      return
    }
    if (payload.sub != null && allow.includes(payload.sub)) {
      try {
        await checkCapability({ act: payload.prc, res: serverID }, payload, options)
        return
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (
          !message.startsWith('Invalid capability') &&
          !message.startsWith('Invalid payload') &&
          !message.startsWith('Invalid token')
        ) {
          throw err
        }
      }
    }
  }

  throw new Error('Access denied')
}
```

- [ ] **Step 4: Update `checkClientToken` parameter type**

In `packages/server/src/access-control.ts`, update the `checkClientToken` signature: replace `ProcedureAccessRecord` with `AccessRules`. Body unchanged.

```ts
export async function checkClientToken(
  serverID: string,
  rules: AccessRules,
  token: SignedToken,
  options?: DelegationChainOptions,
): Promise<void> {
  // ...existing body, but rename the parameter `record` → `rules` in the call
  // to checkProcedureAccess at the bottom:
  //   await checkProcedureAccess(serverID, rules, ...)
}
```

Concretely the call at the bottom of the function changes from `await checkProcedureAccess(serverID, record, ...)` to `await checkProcedureAccess(serverID, rules, ...)`.

- [ ] **Step 5: Update `server.ts` imports**

In `packages/server/src/server.ts`, update the import block at lines 33–38:

```ts
import {
  type AccessRules,
  checkClientToken,
  type EncryptionPolicy,
  resolveEncryptionPolicy,
} from './access-control.js'
```

(Drops `ProcedureAccessRecord`, adds `AccessRules`. Other imports unchanged.)

- [ ] **Step 6: Update `ServerParams` and `HandleOptions` to use renamed type**

In `packages/server/src/server.ts`, replace the existing `ServerParams.accessControl` and `HandleOptions.accessControl` field types from `false | true | ProcedureAccessRecord` to `false | true | AccessRules`. (Full discriminated-union refactor happens in Task 2; this step is a pure rename.)

Concretely lines 600 and 616: change `ProcedureAccessRecord` → `AccessRules`.

- [ ] **Step 7: Build to confirm rename compiles**

```bash
pnpm --filter @enkaku/server run build
```

Expected: `tsc` succeeds for the server package. Other packages may break in tests; don't run tests yet — Task 2 keeps refactor going.

- [ ] **Step 8: Update existing `access-control.test.ts` to consume new shape**

`packages/server/test/access-control.test.ts` uses the existing record shape with shorthand boolean and Array values. Convert each test case mechanically:

- `'*': false` → `'*': { allow: ['__never__'] }` only when the test relied on `false` meaning "skip this entry". Alternative: drop the `'*': false` entry entirely (omission is equivalent under new semantics). Use the latter — drop those entries.
- `'*': true` → `'*': { allow: true }`
- `'enkaku:graph/test': true` → `'enkaku:graph/test': { allow: true }`
- `'enkaku:graph/test': ['did:key:abc']` → `'enkaku:graph/test': { allow: ['did:key:abc'] }`
- `'enkaku:graph/test': { allow: ['did:key:abc'], encryption: 'required' }` → unchanged (already config form).

Open `packages/server/test/access-control.test.ts` and rewrite every `checkClientToken(..., RULES, ...)` call to use the new shape. Delete entries that were `false` (skip) since they no longer have an explicit form.

Specifically:
- Lines 15, 34, 45, 56: `{ '*': false }` → `{}`
- Line 70: `{ '*': false, 'enkaku:graph/test': true }` → `{ 'enkaku:graph/test': { allow: true } }`
- Line 6: rename import — replace `type ProcedureAccessConfig` with `type AccessRule`. Update all references (search the file for `ProcedureAccessConfig` and replace with `AccessRule`).
- Any test using shorthand `Array<string>` value needs wrapping in `{ allow: ... }`.

Read the whole file first, then apply edits per occurrence.

- [ ] **Step 9: Update `access-control-config.test.ts`**

Open `packages/server/test/access-control-config.test.ts`. Convert:

- `accessControl: { test: ['did:key:abc'] }` (lines 36, 67, 86) → `accessControl: { test: { allow: ['did:key:abc'] } }`

(Top-level field name is still `accessControl` — it changes to `accessRules` in Task 2.)

- [ ] **Step 10: Update `encryption-policy.test.ts`**

Open `packages/server/test/encryption-policy.test.ts`. Search for any `accessControl` record values using shorthand `boolean` or `Array<string>`; wrap them in `{ allow: ... }`. Encryption-config form should remain identical.

- [ ] **Step 11: Update other server-package tests that use record shorthand**

For each of the following files, search for `accessControl:` and convert any shorthand record values to `{ allow: ... }` form. The top-level `accessControl: false | true` calls are unchanged for now (Task 2 renames them).

- `packages/server/test/buffer-limits.test.ts`
- `packages/server/test/lifecycle-events.test.ts`
- `packages/server/test/controller-timeout.test.ts`
- `packages/server/test/channel-send-auth.test.ts`
- `packages/server/test/verify-token-hook.test.ts`
- `packages/server/test/validation-warning.test.ts`
- `packages/server/test/resource-limits.test.ts`
- `packages/server/test/event-auth.test.ts`
- `packages/server/test/stream-crash.test.ts`
- `packages/server/test/dispose-timeout.test.ts`

Use grep to spot non-config entries:

```bash
grep -n "accessControl" packages/server/test/*.test.ts | grep -v "accessControl: false" | grep -v "accessControl: true" | grep -v "accessControl: {"
```

Inspect each match and wrap as needed.

- [ ] **Step 12: Run server-package tests**

```bash
pnpm --filter @enkaku/server run test
```

Expected: all server tests pass. Failures here mean a missed conversion — go back and fix.

- [ ] **Step 13: Commit**

```bash
git add packages/server/src/access-control.ts packages/server/src/server.ts packages/server/test
git commit -m "refactor(server): rename ProcedureAccessRecord → AccessRules, drop value shorthand"
```

---

## Task 2: Refactor `ServerParams` to identity-driven discriminated union

**Files:**
- Modify: `packages/server/src/server.ts`
- Modify: `packages/server/test/access-control-config.test.ts`

Replace `accessControl?: false | true | AccessRules` on `ServerParams` with `accessRules?: AccessRules`. Identity presence becomes the auth-mode discriminator.

- [ ] **Step 1: Update `ServerParams` type**

In `packages/server/src/server.ts`, replace the existing `ServerParams` type (around lines 599–613) with:

```ts
type BaseServerParams<Protocol extends ProtocolDefinition> = {
  encryptionPolicy?: EncryptionPolicy
  getRandomID?: () => string
  runtime?: Runtime
  handlers: ProcedureHandlers<Protocol>
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  tracer?: Tracer
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
  verifyToken?: VerifyTokenHook
}

export type ServerParams<Protocol extends ProtocolDefinition> =
  | (BaseServerParams<Protocol> & { identity?: undefined; accessRules?: never })
  | (BaseServerParams<Protocol> & { identity: Identity; accessRules?: AccessRules })
```

- [ ] **Step 2: Update constructor logic**

In `packages/server/src/server.ts`, replace the constructor block at lines 684–718 with:

```ts
const accessRules = (params as { accessRules?: AccessRules }).accessRules

if (serverID == null) {
  if (accessRules != null) {
    throw new Error('Invalid server parameters: "accessRules" requires "identity"')
  }
  this.#accessControl = {
    requireAuth: false,
    access: {},
    encryptionPolicy: params.encryptionPolicy,
    verifyToken: params.verifyToken,
  }
} else {
  this.#accessControl = {
    requireAuth: true,
    serverID,
    access: accessRules ?? {},
    encryptionPolicy: params.encryptionPolicy,
    verifyToken: params.verifyToken,
  }
}
```

The `(params as { accessRules?: AccessRules })` cast bypasses the discriminated-union narrowing for runtime access — the constructor is the one place that has to read the field generically. The runtime check still throws if a caller bypasses TS and passes `accessRules` without identity.

- [ ] **Step 3: Update `access-control-config.test.ts` for new shape**

Rewrite the test file end-to-end:

```ts
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, Server } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'object' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const handlers = { test: vi.fn() } as unknown as ProcedureHandlers<Protocol>

describe('Server accessRules configuration', () => {
  test('builds standalone server when no identity and no accessRules', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol })
    }).not.toThrow()
  })

  test('throws when accessRules provided without identity', () => {
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        // @ts-expect-error - accessRules requires identity at the type level
        accessRules: { test: { allow: ['did:key:abc'] } },
      })
    }).toThrow('"accessRules" requires "identity"')
  })

  test('defaults to server-only access when identity provided without accessRules', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({ handlers, protocol, identity: signer })
    }).not.toThrow()
  })

  test('allows identity with accessRules record', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        identity: signer,
        accessRules: { test: { allow: ['did:key:abc'] } },
      })
    }).not.toThrow()
  })

  test('handle() rejects accessRules override requiring auth when server has no identity', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = new Server<Protocol>({ handlers, protocol })

    await expect(
      server.handle(transports.server, {
        accessRules: { test: { allow: ['did:key:abc'] } },
      }),
    ).rejects.toThrow('identity is required')

    await server.dispose()
    await transports.dispose()
  })
})
```

- [ ] **Step 4: Run access-control-config tests**

```bash
pnpm --filter @enkaku/server run test -- access-control-config
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/access-control-config.test.ts
git commit -m "refactor(server): identity-driven ServerParams.accessRules"
```

---

## Task 3: Refactor `HandleOptions` to `accessRules`

**Files:**
- Modify: `packages/server/src/server.ts`

`HandleOptions.accessControl` keeps its `false` escape hatch (per-transport public override) but renames to `accessRules`.

- [ ] **Step 1: Update `HandleOptions` type**

In `packages/server/src/server.ts`, replace the existing `HandleOptions` type (around lines 615–619) with:

```ts
export type HandleOptions = {
  accessRules?: false | AccessRules
  logger?: Logger
  verifyToken?: VerifyTokenHook
}
```

- [ ] **Step 2: Update `handle()` override branch**

In `packages/server/src/server.ts`, locate the `handle()` method (around lines 739–777). Replace `options.accessControl` reads with `options.accessRules`:

- Line 740: `const accessControlOverride = options.accessControl` → `const accessRulesOverride = options.accessRules`
- Lines 748, 755: `accessControlOverride === false` and `accessControlOverride != null` → `accessRulesOverride === false` and `accessRulesOverride != null`
- Line 763: `accessControlOverride === true ? {} : accessControlOverride` becomes simply `accessRulesOverride` (no `true` variant exists).

Result for the override branch:

```ts
} else if (accessRulesOverride != null) {
  // Override with AccessRules record
  const serverID = this.#accessControl.serverID
  if (serverID == null) {
    return Promise.reject(
      new Error('Server identity is required to enable access control on transport'),
    )
  }
  accessControl = {
    requireAuth: true,
    serverID,
    access: accessRulesOverride,
    encryptionPolicy,
    verifyToken: options.verifyToken ?? this.#accessControl.verifyToken,
  }
}
```

- [ ] **Step 3: Build server package**

```bash
pnpm --filter @enkaku/server run build
```

Expected: clean.

- [ ] **Step 4: Run server tests**

```bash
pnpm --filter @enkaku/server run test
```

Expected: tests still pass. The handle-override test in `access-control-config.test.ts` (Task 2) already uses `accessRules`.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server.ts
git commit -m "refactor(server): rename HandleOptions.accessControl → accessRules"
```

---

## Task 4: Update server package exports

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Replace export block**

In `packages/server/src/index.ts`, replace the existing access-control exports (lines 13–19) with:

```ts
export type { AccessRule, AccessRules, EncryptionPolicy } from './access-control.js'
export { resolveEncryptionPolicy } from './access-control.js'
```

(`AllowContext` and `AllowPredicate` will be added in Task 6.)

- [ ] **Step 2: Build server package**

```bash
pnpm --filter @enkaku/server run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "refactor(server): drop ProcedureAccess* exports"
```

---

## Task 5: Migrate enkaku consumers (mechanical rename)

Each consumer either re-exports the access-control surface, calls `serve()`, or uses `Server`/`HandleOptions`. The mapping is mechanical:

| Today | New |
|-------|-----|
| `accessControl: false` (no identity) | omit `accessControl` and `accessRules` entirely |
| `accessControl: true` | omit `accessRules` (default `{}` server-only) |
| `accessControl: { 'foo': true }` | `accessRules: { 'foo': { allow: true } }` |
| `accessControl: { 'foo': ['did:a'] }` | `accessRules: { 'foo': { allow: ['did:a'] } }` |
| `HandleOptions.accessControl: false` | `HandleOptions.accessRules: false` |

**Files:**
- Modify: `packages/standalone/src/index.ts`
- Modify: `packages/hub-server/src/hub.ts`
- Modify: `packages/electron-rpc/src/main.ts`
- Modify: `packages/hub-client/test/client.test.ts`
- Modify: `packages/http-server-transport/test/lib.test.ts`
- Modify: `packages/hub-server/test/hub.test.ts`
- Modify: `packages/hub-tunnel/test/transport-channel.test.ts`
- Modify: `packages/hub-tunnel/test/echo-protocol.test.ts`
- Modify: `packages/hub-tunnel/test/transport-concurrent.test.ts`
- Modify: `packages/hub-tunnel/test/transport.test.ts`
- Modify: `packages/hub-tunnel/test/encrypted-transport-e2e.test.ts`
- Modify: `tests/deno/stateful-server.ts`
- Modify: `tests/integration/client-lifecycle.test.ts`
- Modify: `tests/integration/otel.test.ts`
- Modify: `tests/integration/hub-tunnel-echo.test.ts`
- Modify: `tests/integration/teardown.test.ts`
- Modify: `tests/integration/http-transport.test.ts`
- Modify: `tests/integration/server-teardown-no-unhandled.test.ts`
- Modify: `tests/integration/client-server.test.ts`
- Modify: `tests/integration/close-settles.test.ts`

- [ ] **Step 1: Refactor `packages/standalone/src/index.ts`**

Replace the file with:

```ts
/**
 * Standalone client and server for Enkaku RPC.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/standalone
 * ```
 *
 * @module standalone
 */

import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type AccessRules, type ProcedureHandlers, serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'

export type StandaloneOptions<Protocol extends ProtocolDefinition> = {
  accessRules?: AccessRules
  getRandomID?: () => string
  protocol?: Protocol
  signal?: AbortSignal
  identity?: Identity
}

export function standalone<Protocol extends ProtocolDefinition>(
  handlers: ProcedureHandlers<Protocol>,
  options: StandaloneOptions<Protocol> = {},
): Client<Protocol> {
  const { accessRules, getRandomID, protocol, signal, identity } = options
  const transports = new DirectTransports<
    AnyServerMessageOf<Protocol>,
    AnyClientMessageOf<Protocol>
  >({ signal })

  const serverID = identity ? identity.id : undefined
  if (serverID == null) {
    serve<Protocol>({
      handlers,
      protocol,
      signal,
      transport: transports.server,
    })
  } else {
    serve<Protocol>({
      handlers,
      identity,
      protocol,
      signal,
      transport: transports.server,
      accessRules,
    })
  }
  return new Client<Protocol>({ getRandomID, serverID, identity, transport: transports.client })
}
```

The two-branch `serve()` call satisfies the discriminated union (cannot pass `accessRules` when identity is undefined).

- [ ] **Step 2: Refactor `packages/hub-server/src/hub.ts`**

Replace the file with:

```ts
import type { HubProtocol, HubStore } from '@enkaku/hub-protocol'
import type { ServerTransportOf } from '@enkaku/protocol'
import type { AccessRules, Server } from '@enkaku/server'
import { serve } from '@enkaku/server'
import type { Identity } from '@enkaku/token'

import { createHandlers } from './handlers.js'
import { HubClientRegistry } from './registry.js'

export type CreateHubParams = {
  transport: ServerTransportOf<HubProtocol>
  store: HubStore
  accessRules?: AccessRules
  identity?: Identity
}

export type HubInstance = {
  registry: HubClientRegistry
  server: Server<HubProtocol>
}

export function createHub(params: CreateHubParams): HubInstance {
  const registry = new HubClientRegistry()
  const handlers = createHandlers({ registry, store: params.store })
  const server = params.identity != null
    ? serve<HubProtocol>({
        handlers,
        transport: params.transport,
        identity: params.identity,
        accessRules: params.accessRules,
      })
    : serve<HubProtocol>({
        handlers,
        transport: params.transport,
      })
  return { registry, server }
}
```

- [ ] **Step 3: Refactor `packages/electron-rpc/src/main.ts`**

In `packages/electron-rpc/src/main.ts`, find the line `server = serve<Protocol>({ transport, accessControl: false, ...serverParams })` (around line 66). Replace with:

```ts
server = serve<Protocol>({ transport, ...serverParams })
```

If `serverParams` may legitimately carry `identity`, this preserves correct behavior — no identity ⇒ standalone server. If `serverParams.accessRules` exists with no identity it will throw at construction; this is the intended new contract.

Inspect surrounding code for any other `accessControl` reference and remove. Run grep:

```bash
grep -n "accessControl" packages/electron-rpc/src/main.ts
```

Expected: no remaining matches.

- [ ] **Step 4: Refactor remaining test files**

For each of the test files listed above (hub-client, http-server-transport, hub-server, hub-tunnel × 5, tests/deno, tests/integration × 8), apply the mapping:

For each `serve<Protocol>({ ..., accessControl: false, ... })` call where there is **no** `identity` — drop the `accessControl: false` field entirely.

For each call with `identity` and `accessControl: false` — drop the field; if the test expects public ingress with the identity present, replace with `accessRules: { '*': { allow: true } }`. (Inspect the test intent. In our codebase scan, none of the listed integration tests pair identity with `accessControl: false`; standalone-style tests just drop the field.)

For each `accessControl: true` — drop the field (default behavior).

For each `accessControl: { ... }` — convert per-entry shorthand to config form (Step 8 of Task 1 already documents the mapping) and rename the field to `accessRules`.

For each `handle()` call passing `accessControl: false` or `accessControl: { ... }` — rename to `accessRules` and convert per-entry as above.

Inspect each file individually. Run after each change:

```bash
grep -n "accessControl" <file>
```

Expected: no matches once the file is converted.

A worked example for `tests/integration/client-server.test.ts` line 40:

Before:

```ts
serve<Protocol>({ handlers, accessControl: false, transport: transports.server })
```

After:

```ts
serve<Protocol>({ handlers, transport: transports.server })
```

- [ ] **Step 5: Verify no `accessControl` references remain in enkaku**

```bash
grep -rn "accessControl" packages tests --include="*.ts"
```

Expected: no matches. If any remain, convert them.

- [ ] **Step 6: Build and test enkaku**

```bash
pnpm run build
pnpm run test
```

Expected: clean. Failures here are missed conversions or downstream type errors.

- [ ] **Step 7: Commit**

```bash
git add packages tests
git commit -m "refactor: migrate enkaku consumers to accessRules"
```

---

## Task 6: Add `AllowContext`, `AllowPredicate` types

**Files:**
- Modify: `packages/server/src/access-control.ts`
- Modify: `packages/server/src/index.ts`

Type-only changes. No new runtime branch yet — that arrives in Task 7.

- [ ] **Step 1: Add types after the existing type block**

In `packages/server/src/access-control.ts`, add the following after the `EncryptionPolicy` type:

```ts
export type AllowContext = {
  pattern: string
  procedure: string
  payload: ProcedureAccessPayload
  serverID: string
  verifyDelegation: () => Promise<boolean>
}

export type AllowPredicate = (
  ctx: AllowContext,
) => boolean | Promise<boolean>
```

`ProcedureAccessPayload` is defined later in the same file (currently lines 52–58). TypeScript hoists type declarations so forward reference is fine, but keep declarations in source-readable order: place `ProcedureAccessPayload` immediately above the new types (before `AllowContext`).

End-state ordering of the type block:

```ts
export type EncryptionPolicy = 'required' | 'optional' | 'none'

export type ProcedureAccessPayload = {
  iss: string
  sub?: string
  aud?: string
  prc?: string
  exp?: number
}

export type AllowContext = {
  pattern: string
  procedure: string
  payload: ProcedureAccessPayload
  serverID: string
  verifyDelegation: () => Promise<boolean>
}

export type AllowPredicate = (
  ctx: AllowContext,
) => boolean | Promise<boolean>

export type AccessRule = {
  allow: true | Array<string> | AllowPredicate
  encryption?: EncryptionPolicy
}

export type AccessRules = Record<string, AccessRule>
```

(Note `AccessRule.allow` now includes `AllowPredicate`. The runtime branch comes in Task 7.)

Delete the old standalone `ProcedureAccessPayload` declaration further down (currently lines 52–58 if still present after Task 1) so it isn't declared twice.

- [ ] **Step 2: Add type exports**

In `packages/server/src/index.ts`, extend the access-control export block:

```ts
export type {
  AccessRule,
  AccessRules,
  AllowContext,
  AllowPredicate,
  EncryptionPolicy,
} from './access-control.js'
export { resolveEncryptionPolicy } from './access-control.js'
```

- [ ] **Step 3: Build server package**

```bash
pnpm --filter @enkaku/server run build
```

Expected: clean. Existing tests remain green because the predicate variant has no runtime branch yet — `allow` is still narrowed to `true | Array<string>` at every existing call site.

- [ ] **Step 4: Run server tests (sanity)**

```bash
pnpm --filter @enkaku/server run test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/access-control.ts packages/server/src/index.ts
git commit -m "feat(server): add AllowContext and AllowPredicate types"
```

---

## Task 7: Predicate variant — failing test

**Files:**
- Create: `packages/server/test/access-control-predicate.test.ts`

TDD seed. Write a test that exercises the predicate path. It will fail until Task 8 lands.

- [ ] **Step 1: Create the test file**

Write `packages/server/test/access-control-predicate.test.ts`:

```ts
import type { AnyClientPayloadOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { describe, expect, test, vi } from 'vitest'

import { type AllowContext, checkClientToken } from '../src/access-control.js'

type Payload = AnyClientPayloadOf<ProtocolDefinition>

describe('access control: predicate variant', () => {
  test('predicate accepts on iss', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    const predicate = vi.fn(({ payload }: AllowContext) => payload.iss === clientSigner.id)

    await expect(
      checkClientToken(serverSigner.id, {
        'enkaku:graph/test': { allow: predicate },
      }, token),
    ).resolves.toBeUndefined()

    expect(predicate).toHaveBeenCalledTimes(1)
  })

  test('predicate rejects → Access denied', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
    } as unknown as Payload)

    await expect(
      checkClientToken(serverSigner.id, {
        'enkaku:graph/test': { allow: () => false },
      }, token),
    ).rejects.toThrow('Access denied')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @enkaku/server run test -- access-control-predicate
```

Expected: FAIL. Vitest reports both tests failing — likely with an assertion mismatch or a runtime error from the unhandled `allow` shape (a function value falls through the `allow === true` and `Array.isArray(allow)` branches and ends in the implicit `Array<string>` arm, where `.includes` throws or returns false).

---

## Task 8: Predicate variant — implementation

**Files:**
- Modify: `packages/server/src/access-control.ts`

- [ ] **Step 1: Replace `checkProcedureAccess` body**

In `packages/server/src/access-control.ts`, replace the current `checkProcedureAccess` (rewritten in Task 1) with:

```ts
export async function checkProcedureAccess(
  serverID: string,
  rules: AccessRules,
  token: SignedToken<ProcedureAccessPayload>,
  options?: DelegationChainOptions,
): Promise<void> {
  const payload = token.payload
  if (payload.prc == null) {
    throw new Error('No procedure to check')
  }

  const procedure = payload.prc

  for (const [pattern, rule] of Object.entries(rules)) {
    if (!hasPartsMatch(procedure, pattern)) continue

    const verifyDelegation = async (): Promise<boolean> => {
      if (payload.sub == null) return false
      try {
        await checkCapability({ act: procedure, res: serverID }, payload, options)
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (
          message.startsWith('Invalid capability') ||
          message.startsWith('Invalid payload') ||
          message.startsWith('Invalid token')
        ) {
          return false
        }
        throw err
      }
    }

    const { allow } = rule

    if (allow === true) {
      return
    }

    if (Array.isArray(allow)) {
      if (allow.includes(payload.iss)) return
      if (payload.sub != null && allow.includes(payload.sub)) {
        if (await verifyDelegation()) return
      }
      continue
    }

    // allow is AllowPredicate
    const ctx: AllowContext = {
      pattern,
      procedure,
      payload,
      serverID,
      verifyDelegation,
    }
    if (await allow(ctx)) return
    // Predicate returned false — fall through to next pattern
  }

  throw new Error('Access denied')
}
```

The Array branch is unchanged from Task 1 except that `verifyDelegation` (a closure here) replaces the inline try/catch. Behavior bit-for-bit identical for the Array arm.

- [ ] **Step 2: Run the predicate test to verify it passes**

```bash
pnpm --filter @enkaku/server run test -- access-control-predicate
```

Expected: PASS.

- [ ] **Step 3: Run all server tests**

```bash
pnpm --filter @enkaku/server run test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/access-control.ts packages/server/test/access-control-predicate.test.ts
git commit -m "feat(server): predicate variant for access rules"
```

---

## Task 9: Predicate context coverage tests

**Files:**
- Modify: `packages/server/test/access-control-predicate.test.ts`

- [ ] **Step 1: Add a test for context fields**

Append to `packages/server/test/access-control-predicate.test.ts`:

```ts
test('predicate receives full AllowContext', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
  } as unknown as Payload)

  const predicate = vi.fn(() => true)

  await checkClientToken(serverSigner.id, {
    'enkaku:graph/*': { allow: predicate },
  }, token)

  expect(predicate).toHaveBeenCalledTimes(1)
  const ctx = predicate.mock.calls[0]?.[0] as AllowContext
  expect(ctx.pattern).toBe('enkaku:graph/*')
  expect(ctx.procedure).toBe('enkaku:graph/test')
  expect(ctx.serverID).toBe(serverSigner.id)
  expect(ctx.payload.iss).toBe(clientSigner.id)
  expect(typeof ctx.verifyDelegation).toBe('function')
})
```

- [ ] **Step 2: Run the new test**

```bash
pnpm --filter @enkaku/server run test -- access-control-predicate
```

Expected: PASS.

- [ ] **Step 3: Add a sync vs async predicate test**

Append:

```ts
test('predicate sync return is awaited correctly', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
  } as unknown as Payload)

  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/test': { allow: () => true },
    }, token),
  ).resolves.toBeUndefined()
})

test('predicate async return is awaited correctly', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
  } as unknown as Payload)

  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/test': { allow: async () => true },
    }, token),
  ).resolves.toBeUndefined()
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @enkaku/server run test -- access-control-predicate
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/test/access-control-predicate.test.ts
git commit -m "test(server): predicate context and sync/async coverage"
```

---

## Task 10: `verifyDelegation` helper tests

**Files:**
- Modify: `packages/server/test/access-control-predicate.test.ts`

- [ ] **Step 1: Write delegation-passes test**

Append to `access-control-predicate.test.ts`. This test mirrors the existing array-form delegation test in `access-control.test.ts` but routes admission through a predicate that calls `verifyDelegation()`.

```ts
import { createCapability } from '@enkaku/capability'
import { stringifyToken } from '@enkaku/token'

// (above imports go at the top of the file alongside existing imports)

test('verifyDelegation returns true on a valid chain', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const delegation = await createCapability(serverSigner, {
    aud: clientSigner.id,
    sub: serverSigner.id,
    act: 'enkaku:graph/*',
    res: serverSigner.id,
  })
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
    sub: serverSigner.id,
    cap: stringifyToken(delegation),
  } as unknown as Payload)

  const predicate = vi.fn(async ({ payload, verifyDelegation }: AllowContext) => {
    if (payload.sub === serverSigner.id) return await verifyDelegation()
    return false
  })

  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/*': { allow: predicate },
    }, token),
  ).resolves.toBeUndefined()
})

test('verifyDelegation returns false when sub is missing', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
  } as unknown as Payload)

  const predicate = vi.fn(async ({ verifyDelegation }: AllowContext) => {
    return await verifyDelegation()
  })

  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/test': { allow: predicate },
    }, token),
  ).rejects.toThrow('Access denied')
})
```

- [ ] **Step 2: Run the tests**

```bash
pnpm --filter @enkaku/server run test -- access-control-predicate
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/server/test/access-control-predicate.test.ts
git commit -m "test(server): verifyDelegation behavior in predicate context"
```

---

## Task 11: Predicate-array equivalence + iteration order tests

**Files:**
- Modify: `packages/server/test/access-control-predicate.test.ts`

- [ ] **Step 1: Add equivalence test**

A predicate replicating `allow: ['did:a']` must admit/reject identically.

Append:

```ts
test('predicate replicating array form admits same iss', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
  } as unknown as Payload)

  const allowList = [clientSigner.id]

  const predicate = async ({ payload, verifyDelegation }: AllowContext) => {
    if (allowList.includes(payload.iss)) return true
    if (payload.sub != null && allowList.includes(payload.sub)) {
      return await verifyDelegation()
    }
    return false
  }

  // Predicate form
  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/test': { allow: predicate },
    }, token),
  ).resolves.toBeUndefined()

  // Array form (sanity that the equivalence is the right reference)
  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/test': { allow: allowList },
    }, token),
  ).resolves.toBeUndefined()
})
```

- [ ] **Step 2: Add iteration-order test**

Append:

```ts
test('first matching predicate that returns true wins', async () => {
  const serverSigner = randomIdentity()
  const clientSigner = randomIdentity()
  const token = await clientSigner.signToken({
    prc: 'enkaku:graph/test',
    aud: serverSigner.id,
  } as unknown as Payload)

  const first = vi.fn(() => false)
  const second = vi.fn(() => true)
  const third = vi.fn(() => true)

  await expect(
    checkClientToken(serverSigner.id, {
      'enkaku:graph/*': { allow: first },
      'enkaku:graph/test': { allow: second },
      '*': { allow: third },
    }, token),
  ).resolves.toBeUndefined()

  expect(first).toHaveBeenCalledTimes(1)
  expect(second).toHaveBeenCalledTimes(1)
  expect(third).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @enkaku/server run test -- access-control-predicate
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/server/test/access-control-predicate.test.ts
git commit -m "test(server): predicate-array equivalence and iteration order"
```

---

## Task 12: End-to-end signed-client + predicate test

**Files:**
- Create: `tests/integration/access-control-predicate.test.ts`

A full server + client roundtrip exercising predicate admission over `DirectTransports`.

- [ ] **Step 1: Create the integration test**

```ts
import { Client } from '@enkaku/client'
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { type ProcedureHandlers, type RequestHandler, serve } from '@enkaku/server'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test } from 'vitest'

const protocol = {
  ping: {
    type: 'request',
    result: { type: 'object', properties: { ok: { type: 'boolean' } } },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('access control: predicate end-to-end', () => {
  test('listed DID passes; unlisted DID is denied', async () => {
    const serverIdentity = randomIdentity()
    const allowed = randomIdentity()
    const blocked = randomIdentity()
    const allowedSet = new Set([allowed.id])

    const handlers: ProcedureHandlers<Protocol> = {
      ping: (async () => ({ ok: true })) as RequestHandler<Protocol, 'ping'>,
    }

    const allowedTransports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    serve<Protocol>({
      handlers,
      identity: serverIdentity,
      protocol,
      transport: allowedTransports.server,
      accessRules: {
        '*': { allow: ({ payload }) => allowedSet.has(payload.iss) },
      },
    })
    const allowedClient = new Client<Protocol>({
      identity: allowed,
      serverID: serverIdentity.id,
      transport: allowedTransports.client,
    })
    await expect(allowedClient.request('ping')).resolves.toEqual({ ok: true })
    await allowedClient.dispose()
    await allowedTransports.dispose()

    const blockedTransports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()
    serve<Protocol>({
      handlers,
      identity: serverIdentity,
      protocol,
      transport: blockedTransports.server,
      accessRules: {
        '*': { allow: ({ payload }) => allowedSet.has(payload.iss) },
      },
    })
    const blockedClient = new Client<Protocol>({
      identity: blocked,
      serverID: serverIdentity.id,
      transport: blockedTransports.client,
    })
    await expect(blockedClient.request('ping')).rejects.toThrow(/Access denied|denied/)
    await blockedClient.dispose()
    await blockedTransports.dispose()
  })
})
```

- [ ] **Step 2: Run the integration test**

```bash
pnpm run test -- tests/integration/access-control-predicate
```

Expected: PASS.

If the assertion `rejects.toThrow(/Access denied|denied/)` fails, inspect what error the client surfaces and tighten the regex accordingly. Don't make it lax — the error must be the access-denied path, not a transport or validation error.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/access-control-predicate.test.ts
git commit -m "test(integration): predicate-based admission end-to-end"
```

---

## Task 13: Final verification

- [ ] **Step 1: Full build, lint, test sweep**

```bash
pnpm run build
pnpm run lint
pnpm run test
```

Expected: clean.

- [ ] **Step 2: Confirm no `accessControl` survives in enkaku source or tests**

```bash
grep -rn "accessControl" packages tests --include="*.ts"
```

Expected: no matches.

- [ ] **Step 3: Confirm new exports are available**

```bash
grep -n "AccessRule\|AllowContext\|AllowPredicate" packages/server/src/index.ts
```

Expected: `AccessRule`, `AccessRules`, `AllowContext`, `AllowPredicate` listed.

- [ ] **Step 4: Confirm spec is committed**

```bash
git log --oneline -- docs/superpowers/specs/2026-05-06-access-control-refactor-design.md
```

Expected: at least one commit referencing the spec file.

- [ ] **Step 5: Push branch (if requested by user)**

```bash
git push -u origin feat/access-control
```

Skip if user has not asked for a push.

---

## Out of scope for this plan

- **Kubun migration.** `kubun/packages/plugin-rpc`, `plugin-http`, `plugin-p2p`, `hub` all consume the old shape and need a parallel rename. That work belongs in a kubun-side plan that depends on this enkaku change shipping first.
- **Hub `isAllowed` integration.** The Q2.3 Hub probe wires a predicate via `accessRules` on the kubun side. That lands in the kubun plan.
- **Predicate richer context fields beyond what's specified.** No `token` (full SignedToken) or `role` slot — the spec rejected those for now. Re-open if a use case appears.
