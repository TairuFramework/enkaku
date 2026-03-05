# Capability Verification Hook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional `verifyToken` hook to the capability verification flow, enabling consumers to implement custom checks such as token revocation.

**Architecture:** Add a `verifyToken` callback to `DelegationChainOptions` in `@enkaku/capability`. The hook receives both the parsed `CapabilityToken` and raw token string, and throws to reject. Thread the option through `checkDelegationChain` and `checkCapability`, then expose it on `ServerParams` so the server passes it to the capability check. This is a non-breaking, additive change.

**Tech Stack:** TypeScript, Vitest

**Security audit reference:** Resolves C-04 from `docs/plans/2026-01-28-security-audit.md`

---

### Task 1: Add verifyToken hook to capability package

**Files:**
- Modify: `packages/capability/src/index.ts:30-35` (DelegationChainOptions type)
- Modify: `packages/capability/src/index.ts:310-336` (checkDelegationChain)
- Modify: `packages/capability/src/index.ts:338-385` (checkCapability)
- Test: `packages/capability/test/lib.test.ts`

**Step 1: Write the failing test for checkDelegationChain with verifyToken hook**

Add to the end of `packages/capability/test/lib.test.ts`:

```typescript
describe('verifyToken hook', () => {
  test('checkDelegationChain calls verifyToken for each token in the chain', async () => {
    const signerA = randomIdentity()
    const signerB = randomIdentity()
    const signerC = randomIdentity()

    const delegateToB = await createCapability(signerA, {
      sub: signerA.id,
      aud: signerB.id,
      act: '*',
      res: '*',
    })
    const delegateToC = await createCapability(
      signerB,
      {
        sub: signerA.id,
        aud: signerC.id,
        act: 'test/*',
        res: 'foo/*',
      },
      undefined,
      { parentCapability: stringifyToken(delegateToB) },
    )

    const verified: Array<string> = []
    const verifyToken = vi.fn((_token: unknown, raw: string) => {
      verified.push(raw)
    })

    await checkDelegationChain(
      delegateToC.payload,
      [stringifyToken(delegateToB)],
      { verifyToken },
    )

    expect(verifyToken).toHaveBeenCalledTimes(1)
    expect(verified[0]).toBe(stringifyToken(delegateToB))
  })

  test('checkDelegationChain rejects when verifyToken throws', async () => {
    const signerA = randomIdentity()
    const signerB = randomIdentity()

    const delegateToB = await createCapability(signerA, {
      sub: signerA.id,
      aud: signerB.id,
      act: '*',
      res: '*',
    })

    const verifyToken = vi.fn(() => {
      throw new Error('Token revoked')
    })

    await expect(
      checkDelegationChain(
        delegateToB.payload,
        [stringifyToken(delegateToB)],
        { verifyToken },
      ),
    ).rejects.toThrow('Token revoked')
  })
})
```

Note: add `vi` to the import from `vitest` at the top of the file:
```typescript
import { describe, expect, test, vi } from 'vitest'
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --filter @enkaku/capability`
Expected: FAIL — `verifyToken` is not a recognized option in `DelegationChainOptions`

**Step 3: Update the DelegationChainOptions type and checkDelegationChain implementation**

In `packages/capability/src/index.ts`, update the `DelegationChainOptions` type (around line 30):

```typescript
/** Options for delegation chain validation */
export type DelegationChainOptions = {
  /** Time to use for expiration checks (seconds since epoch). Defaults to now(). */
  atTime?: number
  /** Maximum depth of delegation chain. Defaults to 20. */
  maxDepth?: number
  /** Optional hook called for each verified token in the chain. Throw to reject. */
  verifyToken?: (token: CapabilityToken, raw: string) => void | Promise<void>
}
```

In `checkDelegationChain` (around line 310), add the hook call after `assertCapabilityToken(next)`:

```typescript
export async function checkDelegationChain(
  payload: CapabilityPayload,
  capabilities: Array<string>,
  options?: DelegationChainOptions,
): Promise<void> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DELEGATION_DEPTH
  const atTime = options?.atTime ?? now()

  if (capabilities.length > maxDepth) {
    throw new Error(`Invalid capability: delegation chain exceeds maximum depth of ${maxDepth}`)
  }

  if (capabilities.length === 0) {
    if (payload.iss !== payload.sub) {
      throw new Error('Invalid capability: issuer should be subject')
    }
    assertNonExpired(payload, atTime)
    assertValidIssuedAt(payload, atTime)
    return
  }

  const [head, ...tail] = capabilities
  const next = await verifyToken<CapabilityPayload>(head)
  assertCapabilityToken(next)
  if (options?.verifyToken != null) {
    await options.verifyToken(next, head)
  }
  assertValidDelegation(next.payload, payload, atTime)
  await checkDelegationChain(next.payload, tail, { ...options, atTime })
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- --filter @enkaku/capability`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/capability/src/index.ts packages/capability/test/lib.test.ts
git commit -m "feat(capability): add verifyToken hook to checkDelegationChain"
```

---

### Task 2: Add verifyToken hook to checkCapability

**Files:**
- Modify: `packages/capability/src/index.ts:338-385` (checkCapability)
- Test: `packages/capability/test/lib.test.ts`

**Step 1: Write the failing test**

Add to the `verifyToken hook` describe block in `packages/capability/test/lib.test.ts`:

```typescript
  test('checkCapability calls verifyToken for capability tokens', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const capability = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    const capString = stringifyToken(capability)
    const token = await bob.signToken({
      sub: alice.id,
      prc: 'test/read',
      cap: capString,
    })

    const verifyTokenHook = vi.fn()

    await checkCapability(
      { act: 'test/read', res: 'foo/bar' },
      token.payload,
      undefined,
      { verifyToken: verifyTokenHook },
    )

    expect(verifyTokenHook).toHaveBeenCalledTimes(1)
    expect(verifyTokenHook).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ iss: alice.id, aud: bob.id }),
      }),
      capString,
    )
  })

  test('checkCapability rejects when verifyToken throws for capability', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const capability = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    const token = await bob.signToken({
      sub: alice.id,
      prc: 'test/read',
      cap: stringifyToken(capability),
    })

    const verifyTokenHook = vi.fn(() => {
      throw new Error('Token revoked')
    })

    await expect(
      checkCapability(
        { act: 'test/read', res: 'foo/bar' },
        token.payload,
        undefined,
        { verifyToken: verifyTokenHook },
      ),
    ).rejects.toThrow('Token revoked')
  })

  test('checkCapability does not call verifyToken for self-issued tokens', async () => {
    const alice = randomIdentity()

    const token = await alice.signToken({
      sub: alice.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    const verifyTokenHook = vi.fn()

    await checkCapability(
      { act: 'test/read', res: 'foo/bar' },
      token.payload,
      undefined,
      { verifyToken: verifyTokenHook },
    )

    expect(verifyTokenHook).not.toHaveBeenCalled()
  })

  test('checkCapability calls verifyToken for full delegation chain', async () => {
    const signerA = randomIdentity()
    const signerB = randomIdentity()
    const signerC = randomIdentity()

    const delegateToB = await createCapability(signerA, {
      sub: signerA.id,
      aud: signerB.id,
      act: '*',
      res: 'foo/*',
    })
    const delegateToC = await createCapability(
      signerB,
      {
        sub: signerA.id,
        aud: signerC.id,
        act: 'test/*',
        res: 'foo/bar',
      },
      undefined,
      { parentCapability: stringifyToken(delegateToB) },
    )

    const token = await signerC.signToken({
      sub: signerA.id,
      prc: 'test/call',
      cap: [stringifyToken(delegateToC), stringifyToken(delegateToB)],
    })

    const verifyTokenHook = vi.fn()

    await checkCapability(
      { act: 'test/call', res: 'foo/bar' },
      token.payload,
      undefined,
      { verifyToken: verifyTokenHook },
    )

    // Should be called for both tokens in the chain
    expect(verifyTokenHook).toHaveBeenCalledTimes(2)
  })

  test('checkCapability supports async verifyToken', async () => {
    const alice = randomIdentity()
    const bob = randomIdentity()

    const capability = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    const token = await bob.signToken({
      sub: alice.id,
      prc: 'test/read',
      cap: stringifyToken(capability),
    })

    const verifyTokenHook = vi.fn(async () => {
      // Simulate async revocation check
      await new Promise((resolve) => setTimeout(resolve, 1))
    })

    await checkCapability(
      { act: 'test/read', res: 'foo/bar' },
      token.payload,
      undefined,
      { verifyToken: verifyTokenHook },
    )

    expect(verifyTokenHook).toHaveBeenCalledTimes(1)
  })
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --filter @enkaku/capability`
Expected: FAIL — `checkCapability` doesn't call the hook for the first capability token yet

**Step 3: Update checkCapability to call the hook**

In `packages/capability/src/index.ts`, update `checkCapability` (around line 338). Add the hook call after `assertCapabilityToken(capability)`:

```typescript
export async function checkCapability(
  permission: Permission,
  payload: SignedPayload,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  if (payload.sub == null) {
    throw new Error('Invalid payload: no subject')
  }

  const time = atTime ?? now()
  if (payload.iss === payload.sub) {
    // Subject is issuer, no delegation required
    // But still need to validate the permission is granted
    assertNonExpired(payload, time)
    assertValidIssuedAt(payload as { iat?: number }, time)

    // Validate that the token grants the requested permission
    const p = payload as Record<string, unknown>
    const act = p.act as string | Array<string> | undefined
    const res = p.res as string | Array<string> | undefined

    if (act == null || res == null) {
      throw new Error('Invalid payload: missing act or res for self-issued token')
    }

    if (!hasPermission(permission, { act, res })) {
      throw new Error('Invalid capability: permission not granted')
    }

    return
  }

  if (payload.cap == null) {
    throw new Error('Invalid payload: no capability')
  }

  const [head, ...tail] = Array.isArray(payload.cap) ? payload.cap : [payload.cap]
  if (head == null) {
    throw new Error('Invalid payload: no capability')
  }
  const capability = await verifyToken<CapabilityPayload>(head)
  assertCapabilityToken(capability)
  if (options?.verifyToken != null) {
    await options.verifyToken(capability, head)
  }

  const toCapability = { ...payload, ...permission } as CapabilityPayload
  assertValidDelegation(capability.payload, toCapability, time)
  await checkDelegationChain(capability.payload, tail, { ...options, atTime: time })
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- --filter @enkaku/capability`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/capability/src/index.ts packages/capability/test/lib.test.ts
git commit -m "feat(capability): add verifyToken hook to checkCapability"
```

---

### Task 3: Thread verifyToken through server access control

**Files:**
- Modify: `packages/server/src/access-control.ts:55-93` (checkProcedureAccess)
- Modify: `packages/server/src/access-control.ts:96-129` (checkClientToken)
- Test: `packages/server/test/access-control.test.ts`

**Step 1: Write the failing test**

Add to the end of `packages/server/test/access-control.test.ts`:

```typescript
describe('verifyToken hook', () => {
  test('checkClientToken passes verifyToken option to checkCapability', async () => {
    const serverSigner = randomIdentity()
    const delegationSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const delegation = await createCapability(delegationSigner, {
      aud: clientSigner.id,
      sub: delegationSigner.id,
      act: 'enkaku:graph/*',
      res: serverSigner.id,
    })
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
      sub: delegationSigner.id,
      cap: stringifyToken(delegation),
    } as unknown as Payload)

    const verifyToken = vi.fn()

    await checkClientToken(
      serverSigner.id,
      { '*': false, 'enkaku:graph/test': [delegationSigner.id] },
      token,
      undefined,
      { verifyToken },
    )

    expect(verifyToken).toHaveBeenCalledTimes(1)
  })

  test('checkClientToken rejects when verifyToken hook throws', async () => {
    const serverSigner = randomIdentity()
    const delegationSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const delegation = await createCapability(delegationSigner, {
      aud: clientSigner.id,
      sub: delegationSigner.id,
      act: 'enkaku:graph/*',
      res: serverSigner.id,
    })
    const token = await clientSigner.signToken({
      prc: 'enkaku:graph/test',
      aud: serverSigner.id,
      sub: delegationSigner.id,
      cap: stringifyToken(delegation),
    } as unknown as Payload)

    const verifyToken = vi.fn(() => {
      throw new Error('Token revoked')
    })

    await expect(
      checkClientToken(
        serverSigner.id,
        { '*': false, 'enkaku:graph/test': [delegationSigner.id] },
        token,
        undefined,
        { verifyToken },
      ),
    ).rejects.toThrow('Token revoked')
  })
})
```

Note: add `vi` to the import from `vitest` and `createCapability` from `@enkaku/capability`:
```typescript
import { createCapability } from '@enkaku/capability'
import { describe, expect, test, vi } from 'vitest'
```

(Check if `createCapability` is already imported — it is in the existing file.)

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --filter @enkaku/server -- access-control`
Expected: FAIL — `checkClientToken` doesn't accept a 5th parameter

**Step 3: Update checkProcedureAccess and checkClientToken**

In `packages/server/src/access-control.ts`, add the import and update both functions:

Update the import at the top:
```typescript
import {
  assertNonExpired,
  checkCapability,
  type DelegationChainOptions,
  hasPartsMatch,
} from '@enkaku/capability'
```

Update `checkProcedureAccess` signature and the `checkCapability` call:
```typescript
export async function checkProcedureAccess(
  serverID: string,
  record: ProcedureAccessRecord,
  token: SignedToken<ProcedureAccessPayload>,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  const payload = token.payload
  if (payload.prc == null) {
    throw new Error('No procedure to check')
  }

  for (const [procedure, accessValue] of Object.entries(record)) {
    if (hasPartsMatch(payload.prc, procedure)) {
      const allow = getAllowValue(accessValue)
      if (allow === true) {
        return
      }
      if (allow === false) {
        continue
      }
      if (allow.includes(payload.iss)) {
        return
      }
      if (payload.sub == null || !allow.includes(payload.sub)) {
        continue
      }
      try {
        await checkCapability({ act: payload.prc, res: serverID }, payload, atTime, options)
        return
      } catch {}
    }
  }

  throw new Error('Access denied')
}
```

Update `checkClientToken` signature and both `checkCapability` calls:
```typescript
export async function checkClientToken(
  serverID: string,
  record: ProcedureAccessRecord,
  token: SignedToken,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  const payload = token.payload
  const procedure = (payload as ProcedureAccessPayload).prc
  if (procedure == null) {
    throw new Error('No procedure to check')
  }

  if (payload.iss === serverID) {
    if (payload.aud != null && payload.aud !== serverID) {
      throw new Error('Invalid audience')
    }
    if (payload.exp != null) {
      assertNonExpired(payload, atTime)
    }
    return
  }

  if (payload.sub === serverID) {
    await checkCapability({ act: procedure, res: serverID }, payload, atTime, options)
    return
  }

  if (payload.aud !== serverID) {
    throw new Error('Invalid audience')
  }
  await checkProcedureAccess(
    serverID,
    record,
    token as SignedToken<ProcedureAccessPayload>,
    atTime,
    options,
  )
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- --filter @enkaku/server -- access-control`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/access-control.ts packages/server/test/access-control.test.ts
git commit -m "feat(server): thread verifyToken hook through access control"
```

---

### Task 4: Expose verifyToken on ServerParams

**Files:**
- Modify: `packages/server/src/server.ts:60-73` (AccessControlParams, HandleMessagesParams)
- Modify: `packages/server/src/server.ts:326` (checkClientToken call)
- Modify: `packages/server/src/server.ts:463-477` (ServerParams, HandleOptions)
- Modify: `packages/server/src/server.ts:490-579` (Server constructor)
- Modify: `packages/server/src/server.ts:585-624` (handle method)

**Step 1: Write the failing integration test**

Create `packages/server/test/verify-token-hook.test.ts`:

```typescript
import type { AnyClientMessageOf, AnyServerMessageOf, ProtocolDefinition } from '@enkaku/protocol'
import { randomIdentity, stringifyToken } from '@enkaku/token'
import { createCapability } from '@enkaku/capability'
import { DirectTransports } from '@enkaku/transport'
import { describe, expect, test, vi } from 'vitest'

import { type ProcedureHandlers, serve } from '../src/index.js'

const protocol = {
  test: {
    type: 'request',
    input: { type: 'string' },
    output: { type: 'string' },
  },
} as const satisfies ProtocolDefinition
type Protocol = typeof protocol

describe('Server verifyToken hook', () => {
  test('verifyToken hook is called during capability check', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const verifyToken = vi.fn()

    const handlers = {
      test: vi.fn(async () => 'ok'),
    } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      access: { '*': true },
      verifyToken,
      transport: transports.server,
    })

    // Client sends a request with a capability
    const capability = await createCapability(clientSigner, {
      sub: clientSigner.id,
      aud: serverSigner.id,
      act: 'test',
      res: serverSigner.id,
    })

    const msg = await clientSigner.signToken({
      typ: 'request',
      prc: 'test',
      rid: 'r1',
      prm: 'hello',
      aud: serverSigner.id,
      sub: clientSigner.id,
      cap: stringifyToken(capability),
    } as const)
    await transports.client.write(msg)

    // Wait for response
    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('result')

    expect(verifyToken).toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })

  test('verifyToken hook rejection prevents handler execution', async () => {
    const serverSigner = randomIdentity()
    const clientSigner = randomIdentity()

    const verifyToken = vi.fn(() => {
      throw new Error('Token revoked')
    })

    const handler = vi.fn(async () => 'ok')
    const handlers = { test: handler } as ProcedureHandlers<Protocol>

    const transports = new DirectTransports<
      AnyServerMessageOf<Protocol>,
      AnyClientMessageOf<Protocol>
    >()

    const server = serve<Protocol>({
      handlers,
      identity: serverSigner,
      access: { '*': true },
      verifyToken,
      transport: transports.server,
    })

    const capability = await createCapability(clientSigner, {
      sub: clientSigner.id,
      aud: serverSigner.id,
      act: 'test',
      res: serverSigner.id,
    })

    const msg = await clientSigner.signToken({
      typ: 'request',
      prc: 'test',
      rid: 'r1',
      prm: 'hello',
      aud: serverSigner.id,
      sub: clientSigner.id,
      cap: stringifyToken(capability),
    } as const)
    await transports.client.write(msg)

    // Should get error response
    const response = await transports.client.read()
    expect(response.value?.payload.typ).toBe('error')

    // Handler should not have been called
    expect(handler).not.toHaveBeenCalled()

    await server.dispose()
    await transports.dispose()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- --filter @enkaku/server -- verify-token-hook`
Expected: FAIL — `verifyToken` is not a recognized property in `ServerParams`

**Step 3: Update ServerParams, AccessControlParams, and the constructor**

In `packages/server/src/server.ts`:

Add `DelegationChainOptions` to the import from `@enkaku/capability`:
```typescript
// Add to existing imports or add new import
import type { DelegationChainOptions } from '@enkaku/capability'
```

Note: `@enkaku/capability` may not be a direct dependency of `@enkaku/server`. Check `packages/server/package.json`. If it is not, the `DelegationChainOptions` type can be imported via `type` import (type-only). However, `checkCapability` is already imported in `access-control.ts`, so `@enkaku/capability` is already a dependency. Import the type in `server.ts`:

```typescript
import type { DelegationChainOptions } from '@enkaku/capability'
```

Update `AccessControlParams` to include the options:
```typescript
export type AccessControlParams = (
  | { public: true; serverID?: string; access?: ProcedureAccessRecord }
  | { public: false; serverID: string; access: ProcedureAccessRecord }
) & { encryptionPolicy?: EncryptionPolicy; delegationOptions?: DelegationChainOptions }
```

Update `ServerParams` to add `verifyToken`:
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
  verifyToken?: DelegationChainOptions['verifyToken']
}
```

Update `HandleOptions`:
```typescript
export type HandleOptions = {
  access?: ProcedureAccessRecord
  logger?: Logger
  public?: boolean
  verifyToken?: DelegationChainOptions['verifyToken']
}
```

In the constructor, pass `verifyToken` into `#accessControl`. Add to both branches where `this.#accessControl` is set:
```typescript
    // In the serverID == null / public branch:
    this.#accessControl = {
      public: true,
      access: params.access,
      encryptionPolicy: params.encryptionPolicy,
      delegationOptions: params.verifyToken != null ? { verifyToken: params.verifyToken } : undefined,
    }

    // In the serverID != null branch:
    this.#accessControl = {
      public: !!params.public,
      serverID,
      access: params.access ?? {},
      encryptionPolicy: params.encryptionPolicy,
      delegationOptions: params.verifyToken != null ? { verifyToken: params.verifyToken } : undefined,
    }
```

In `handle()`, merge the override:
```typescript
    // After resolving accessControl, build delegationOptions
    const delegationOptions: DelegationChainOptions | undefined =
      accessControlOverride?.verifyToken != null
        ? { verifyToken: accessControlOverride.verifyToken }
        : this.#accessControl.delegationOptions

    // Spread into handleMessages params
    const done = handleMessages<Protocol>({
      events: this.#events,
      handlers: this.#handlers,
      limiter: this.#limiter,
      logger,
      signal: this.#abortController.signal,
      transport,
      validator: this.#validator,
      ...accessControl,
      delegationOptions,
    })
```

Note: `accessControlOverride` here refers to the resolved options variable — adjust to match the actual variable name used in `handle()`. In the current code, the per-transport options variable is `options`.

In `handleMessages`, update the `checkClientToken` call (around line 326) to pass the options:
```typescript
          await checkClientToken(
            params.serverID,
            params.access,
            message as unknown as SignedToken,
            undefined,
            params.delegationOptions,
          )
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- --filter @enkaku/server -- verify-token-hook`
Expected: PASS

**Step 5: Run all server tests to ensure nothing broke**

Run: `pnpm run test:unit -- --filter @enkaku/server`
Expected: All PASS

**Step 6: Commit**

```bash
git add packages/server/src/server.ts packages/server/test/verify-token-hook.test.ts
git commit -m "feat(server): expose verifyToken hook on ServerParams"
```

---

### Task 5: Export the verifyToken type from capability package

**Files:**
- Modify: `packages/capability/src/index.ts` (ensure DelegationChainOptions is exported — it already is)

**Step 1: Verify DelegationChainOptions is exported**

Check that `DelegationChainOptions` is already exported from `packages/capability/src/index.ts`. It should be — it uses `export type`. No changes needed if so.

**Step 2: Run full test suite**

Run: `pnpm run test`
Expected: All PASS

**Step 3: Run build**

Run: `pnpm run build`
Expected: Clean build

**Step 4: Run linter**

Run: `pnpm run lint`
Expected: No errors

**Step 5: Commit (if any changes were needed)**

```bash
git commit -m "chore: verify exports and full build"
```

---

### Task 6: Update security audit doc

**Files:**
- Modify: `docs/plans/2026-01-28-security-audit.md`

**Step 1: Update C-04 status**

Change C-04 from `[ ] Not Started` to `[x] Fixed` with branch reference. Update the description to explain the hook approach:

```markdown
### C-04: No Capability Revocation Mechanism
- **Package:** `@enkaku/capability`
- **File:** `packages/capability/src/index.ts` (entire file)
- **Status:** [x] Fixed — `verifyToken` hook in `DelegationChainOptions`

**Description:**
There is no revocation mechanism for capabilities. Once issued, a capability cannot be revoked early.

**Fix Applied:**
Added optional `verifyToken` hook to `DelegationChainOptions`, called for each verified token in the delegation chain during `checkCapability()` and `checkDelegationChain()`. Consumers can implement revocation by checking token `jti` against a revocation store in the hook. The hook receives both the parsed `CapabilityToken` and raw token string for caching. The server exposes this via `ServerParams.verifyToken`. Throw from the hook to reject a token.
```

**Step 2: Update executive summary**

Change C-04 from "Remaining" to "Fixed".

**Step 3: Update breaking changes section**

Remove C-04 from "Remaining breaking changes" (this is additive, not breaking).

**Step 4: Commit**

```bash
git add docs/plans/2026-01-28-security-audit.md
git commit -m "docs: mark C-04 as fixed in security audit"
```
