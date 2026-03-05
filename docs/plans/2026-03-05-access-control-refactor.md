# Access Control API Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `public` boolean + `access` record with a unified `accessControl` parameter on `ServerParams`, `ServeParams`, `HandleOptions`, and internal types.

**Architecture:** The `public` boolean and `access` record are merged into a single `accessControl` field that accepts `false` (public/no auth), `true` (server-only, implicit default when identity is provided), or a `ProcedureAccessRecord` (granular rules). This eliminates the contradictory state where `public: true` silently ignores access records. The server constructor validates that omitting `identity` requires explicit `accessControl: false`.

**Tech Stack:** TypeScript, Vitest

**Security audit reference:** Resolves H-17 from `docs/plans/2026-01-28-security-audit.md`

---

### Behavioral summary

| `identity` | `accessControl` | Behavior |
|---|---|---|
| provided | omitted | defaults to `true` -- server-only access |
| provided | `true` | explicit server-only access |
| provided | `false` | public (identity still available for signing) |
| provided | `ProcedureAccessRecord` | granular per-procedure rules |
| omitted | `false` | public, no identity |
| omitted | omitted | **throw** -- must explicitly set `accessControl: false` |
| omitted | `true` | **throw** -- can't enforce auth without identity |
| omitted | `ProcedureAccessRecord` | **throw** -- can't enforce auth without identity |

### Files affected

- `packages/server/src/server.ts` -- `ServerParams`, `HandleOptions`, `AccessControlParams`, `Server` constructor, `handle()` method
- `packages/server/src/access-control.ts` -- no changes needed (internal `checkClientToken`/`checkProcedureAccess` signatures stay the same)
- `packages/server/src/index.ts` -- re-exports (no change expected)
- `packages/server/test/public-access-warning.test.ts` -- rewrite entirely (warnings become errors)
- `packages/server/test/access-control.test.ts` -- no changes (tests `checkClientToken` directly)
- `packages/server/test/channel-send-auth.test.ts` -- update `public`/`access` to `accessControl`
- `packages/server/test/buffer-limits.test.ts` -- update `public: true` to `accessControl: false`
- `packages/server/test/controller-timeout.test.ts` -- update `public: true` to `accessControl: false`
- `packages/server/test/dispose-timeout.test.ts` -- update `public: true` to `accessControl: false`
- `packages/server/test/encryption-policy.test.ts` -- update `public: true` to `accessControl: false`
- `packages/server/test/event-auth.test.ts` -- update `public: false` + `access` to `accessControl`
- `packages/server/test/resource-limits.test.ts` -- update `public: true` to `accessControl: false`
- `packages/server/test/stream-crash.test.ts` -- update `public: true` to `accessControl: false`
- `packages/server/test/validation-warning.test.ts` -- update `public: true` to `accessControl: false`
- `packages/electron-rpc/src/main.ts` -- update `serveProcess` and `ServeProcessParams`
- `tests/integration/client-server.test.ts` -- update `public: true` to `accessControl: false`
- `tests/integration/http-transport.test.ts` -- update `public: true` to `accessControl: false`
- `tests/deno/stateful-server.ts` -- update `public: true` to `accessControl: false`
- `packages/http-server-transport/test/lib.test.ts` -- update `public: true` to `accessControl: false`

---

### Task 1: Update types and constructor validation

**Files:**
- Modify: `packages/server/src/server.ts:60-63` (AccessControlParams)
- Modify: `packages/server/src/server.ts:463-477` (ServerParams, HandleOptions)
- Modify: `packages/server/src/server.ts:490-579` (Server constructor)

**Step 1: Update `AccessControlParams` type**

Replace:
```typescript
export type AccessControlParams = (
  | { public: true; serverID?: string; access?: ProcedureAccessRecord }
  | { public: false; serverID: string; access: ProcedureAccessRecord }
) & { encryptionPolicy?: EncryptionPolicy }
```

With:
```typescript
export type AccessControlParams = (
  | { public: true; serverID?: string; access: ProcedureAccessRecord }
  | { public: false; serverID: string; access: ProcedureAccessRecord }
) & { encryptionPolicy?: EncryptionPolicy }
```

Note: The internal `AccessControlParams` keeps its discriminated union shape -- the `public` field here is internal plumbing derived from the user-facing `accessControl` param. The only change is making `access` required in the public branch (it defaults to `{}`).

**Step 2: Update `ServerParams` and `HandleOptions`**

Replace:
```typescript
export type ServerParams<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  encryptionPolicy?: EncryptionPolicy
  getRandomID?: () => string
  handlers: ProcedureHandlers<Protocol>
  identity?: Identity
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  public?: boolean
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}

export type HandleOptions = { access?: ProcedureAccessRecord; logger?: Logger; public?: boolean }
```

With:
```typescript
export type ServerParams<Protocol extends ProtocolDefinition> = {
  accessControl?: false | true | ProcedureAccessRecord
  encryptionPolicy?: EncryptionPolicy
  getRandomID?: () => string
  handlers: ProcedureHandlers<Protocol>
  identity?: Identity
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}

export type HandleOptions = {
  accessControl?: false | true | ProcedureAccessRecord
  logger?: Logger
}
```

**Step 3: Rewrite the constructor validation logic**

Replace the constructor's access control setup block (lines 531-564) with:

```typescript
    const serverID = params.identity?.id
    this.#logger =
      params.logger ?? getEnkakuLogger('server', { serverID: serverID ?? this.#getRandomID() })

    const accessControl = params.accessControl

    if (serverID == null) {
      // No identity: accessControl must be explicitly false
      if (accessControl !== false) {
        throw new Error(
          'Invalid server parameters: either "identity" must be provided or "accessControl" must be set to false',
        )
      }
      this.#accessControl = {
        public: true,
        access: {},
        encryptionPolicy: params.encryptionPolicy,
      }
    } else if (accessControl === false) {
      // Has identity but public access
      this.#accessControl = {
        public: true,
        serverID,
        access: {},
        encryptionPolicy: params.encryptionPolicy,
      }
    } else {
      // Has identity with access control (true = server-only, record = granular)
      const access =
        accessControl === true || accessControl == null ? {} : accessControl
      this.#accessControl = {
        public: false,
        serverID,
        access,
        encryptionPolicy: params.encryptionPolicy,
      }
    }
```

**Step 4: Rewrite the `handle()` method's access control resolution**

Replace the access control resolution in `handle()` (lines 586-606) with:

```typescript
    const accessControlOverride = options.accessControl
    const logger =
      options.logger ?? this.#logger.getChild('handler').with({ transportID: this.#getRandomID() })

    const encryptionPolicy = this.#accessControl.encryptionPolicy

    let accessControl: AccessControlParams
    if (accessControlOverride === false) {
      accessControl = {
        public: true,
        access: this.#accessControl.access ?? {},
        encryptionPolicy,
      }
    } else if (accessControlOverride != null) {
      // Override with true or ProcedureAccessRecord
      const serverID = this.#accessControl.serverID
      if (serverID == null) {
        return Promise.reject(
          new Error('Server identity is required to enable access control on transport'),
        )
      }
      const access =
        accessControlOverride === true ? {} : accessControlOverride
      accessControl = { public: false, serverID, access, encryptionPolicy }
    } else {
      // Use server-level defaults
      accessControl = { ...this.#accessControl }
    }
```

**Step 5: Run tests to see what breaks**

Run: `pnpm run test:unit -- --filter @enkaku/server`
Expected: Many test failures due to old `public`/`access` params. Constructor error message change will break some tests.

**Step 6: Commit**

```bash
git add packages/server/src/server.ts
git commit -m "refactor(server): replace public/access with unified accessControl param"
```

---

### Task 2: Update server test files (mechanical migration)

All these tests just need `public: true` changed to `accessControl: false`, or `public: false` + `access: {...}` changed to `accessControl: {...}`.

**Files:**
- Modify: `packages/server/test/buffer-limits.test.ts` -- `public: true` -> `accessControl: false` (5 occurrences)
- Modify: `packages/server/test/controller-timeout.test.ts` -- `public: true` -> `accessControl: false` (1 occurrence)
- Modify: `packages/server/test/dispose-timeout.test.ts` -- `public: true` -> `accessControl: false` (1 occurrence)
- Modify: `packages/server/test/encryption-policy.test.ts` -- `public: true` -> `accessControl: false` (1 occurrence)
- Modify: `packages/server/test/resource-limits.test.ts` -- `public: true` -> `accessControl: false` (2 occurrences)
- Modify: `packages/server/test/stream-crash.test.ts` -- `public: true` -> `accessControl: false` (2 occurrences)
- Modify: `packages/server/test/validation-warning.test.ts` -- `public: true` -> `accessControl: false` (2 occurrences)

**Step 1: Apply replacements**

In each file, replace `public: true` with `accessControl: false`. Remove any `access:` params that accompany `public: true` (there shouldn't be any in these files).

**Step 2: Update channel-send-auth.test.ts**

This file has both `public: true` and `public: false` + `access: {...}`:
- `public: true` -> `accessControl: false`
- `public: false` + `access: { chat: true }` -> `accessControl: { chat: true }`
- Remove standalone `access:` lines

**Step 3: Update event-auth.test.ts**

- `public: false` + `access: { ... }` -> `accessControl: { ... }`
- Remove standalone `access:` lines

**Step 4: Run server tests**

Run: `pnpm run test:unit -- --filter @enkaku/server`
Expected: Most tests pass. `public-access-warning.test.ts` still fails (handled in Task 3).

**Step 5: Commit**

```bash
git add packages/server/test/
git commit -m "test(server): migrate tests to accessControl param"
```

---

### Task 3: Rewrite public-access-warning tests

The warning tests become error tests since conflicting config now throws.

**Files:**
- Rewrite: `packages/server/test/public-access-warning.test.ts` -- rename to `packages/server/test/access-control-config.test.ts`

**Step 1: Delete old file and create new test**

```typescript
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity } from '@enkaku/token'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, Server } from '../src/index.js'

const protocol = {
  test: {
    type: 'event',
    data: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

const handlers = { test: vi.fn() } as ProcedureHandlers<Protocol>

describe('Server accessControl configuration', () => {
  test('throws when no identity and no accessControl', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol })
    }).toThrow('"identity" must be provided or "accessControl" must be set to false')
  })

  test('throws when no identity and accessControl: true', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol, accessControl: true })
    }).toThrow('"identity" must be provided or "accessControl" must be set to false')
  })

  test('throws when no identity and accessControl is a record', () => {
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        accessControl: { test: ['did:key:abc'] },
      })
    }).toThrow('"identity" must be provided or "accessControl" must be set to false')
  })

  test('allows no identity with accessControl: false', () => {
    expect(() => {
      new Server<Protocol>({ handlers, protocol, accessControl: false })
    }).not.toThrow()
  })

  test('defaults to server-only access when identity provided without accessControl', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({ handlers, protocol, identity: signer })
    }).not.toThrow()
  })

  test('allows identity with accessControl: false (public with identity)', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({ handlers, protocol, identity: signer, accessControl: false })
    }).not.toThrow()
  })

  test('allows identity with accessControl record', () => {
    const signer = randomIdentity()
    expect(() => {
      new Server<Protocol>({
        handlers,
        protocol,
        identity: signer,
        accessControl: { test: ['did:key:abc'] },
      })
    }).not.toThrow()
  })

  test('handle() rejects accessControl override requiring auth when server has no identity', async () => {
    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = new Server<Protocol>({
      handlers,
      protocol,
      accessControl: false,
    })

    await expect(
      server.handle(transports.server, { accessControl: { test: ['did:key:abc'] } }),
    ).rejects.toThrow('identity is required')

    await server.dispose()
    await transports.dispose()
  })
})
```

**Step 2: Delete old file**

```bash
rm packages/server/test/public-access-warning.test.ts
```

**Step 3: Run server tests**

Run: `pnpm run test:unit -- --filter @enkaku/server`
Expected: All server tests pass.

**Step 4: Commit**

```bash
git add packages/server/test/
git commit -m "test(server): replace public-access-warning tests with access-control-config tests"
```

---

### Task 4: Update external consumers

**Files:**
- Modify: `packages/electron-rpc/src/main.ts:43-46, 66`
- Modify: `tests/integration/client-server.test.ts` (4 occurrences)
- Modify: `tests/integration/http-transport.test.ts` (1 occurrence)
- Modify: `tests/deno/stateful-server.ts` (1 occurrence)
- Modify: `packages/http-server-transport/test/lib.test.ts` (2 occurrences)

**Step 1: Update electron-rpc**

In `packages/electron-rpc/src/main.ts`:
- Line 44: `ServerParams<Protocol>, 'transports'` -- the type picks up the change automatically since `public` is removed from `ServerParams`
- Line 66: Replace `{ public: true, transport, ...serverParams }` with `{ accessControl: false, transport, ...serverParams }`

Note: `serveProcess` currently hardcodes `public: true`. With the new API, it should use `accessControl: false` as default but allow the caller to override via `serverParams`. Since `serverParams` already spreads after, any `accessControl` in `serverParams` will take precedence. But we should change the default: the caller of `serveProcess` should decide. Replace line 66:

```typescript
    server = serve<Protocol>({ transport, ...serverParams })
```

This means callers of `serveProcess` must now provide `accessControl` (or `identity`) explicitly. If they were relying on the hardcoded `public: true`, they need to add `accessControl: false`. This is the correct behavior -- no silent public default.

**Step 2: Update integration tests**

In all integration test files, replace `public: true` with `accessControl: false`:
- `tests/integration/client-server.test.ts` -- 4 occurrences
- `tests/integration/http-transport.test.ts` -- 1 occurrence
- `tests/deno/stateful-server.ts` -- 1 occurrence
- `packages/http-server-transport/test/lib.test.ts` -- 2 occurrences

**Step 3: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/electron-rpc/ tests/ packages/http-server-transport/test/
git commit -m "refactor: migrate external consumers to accessControl param"
```

---

### Task 5: Update security audit doc

**Files:**
- Modify: `docs/plans/2026-01-28-security-audit.md`

**Step 1: Update H-17 status**

Update H-17 from `[~] Mitigated` to `[x] Fixed`, add branch reference and description of the fix.

**Step 2: Commit**

```bash
git add docs/plans/2026-01-28-security-audit.md
git commit -m "docs: mark H-17 as fixed in security audit"
```

---

### Task 6: Build and final verification

**Step 1: Build all packages**

Run: `pnpm run build`
Expected: Clean build, no type errors.

**Step 2: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass.

**Step 3: Run linter**

Run: `pnpm run lint`
Expected: No lint errors.

---

### Migration guide (for changelog/docs)

**Breaking change: `public` and `access` params replaced with `accessControl`**

Before:
```typescript
// Public server
serve({ handlers, public: true, transport })

// Authenticated with access rules
serve({ handlers, identity, public: false, access: { '*': false, 'myProc': true }, transport })
```

After:
```typescript
// Public server
serve({ handlers, accessControl: false, transport })

// Authenticated with access rules
serve({ handlers, identity, accessControl: { '*': false, 'myProc': true }, transport })

// Server-only (default when identity provided)
serve({ handlers, identity, transport })
```

`HandleOptions` follows the same pattern: `{ public, access }` becomes `{ accessControl }`.
