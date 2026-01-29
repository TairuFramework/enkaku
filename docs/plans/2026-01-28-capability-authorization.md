# Capability Authorization Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix capability authorization bypass vulnerabilities and add DoS protection to the `@enkaku/capability` package.

**Status:** COMPLETED
**Branch:** `claude/implement-capability-authorization-b65WS`

**Architecture:**
1. Fix `checkCapability()` to always validate permissions even for self-issued tokens (C-02)
2. Add optional parent capability validation to `createCapability()` for delegated capabilities (C-03)
3. Add configurable depth limit to `checkDelegationChain()` to prevent stack overflow DoS (H-04)
4. Improve type validation in `isCapabilityToken()` to check field types, not just presence (M-04)

**Tech Stack:** TypeScript, Vitest for testing

**Related Issues from Security Audit:**
- C-02: Capability authorization bypass when iss === sub — **FIXED** (`e88ca19`)
- C-03: createCapability() lacks authorization checks — **FIXED** (`0233141`)
- H-04: Unbounded delegation chain depth — **FIXED** (`76a461e`)
- M-04: Incomplete capability token type checking — **FIXED** (`54ff100`)
- T-02: Capability authorization bypass tests — **COVERED** (34 tests)

**Post-plan changes (code review feedback):**
- Added `iss` type validation to `isCapabilityToken()` (`8e5e2a1`)
- Added explicit test for missing `parentCapability` when delegating (`8e5e2a1`)
- Cleaned up type assertions in `checkCapability()` self-issued path (`8e5e2a1`)
- Moved `atTime` parameter into `DelegationChainOptions` record (`948cafb`)

---

## Task 1: Write Failing Tests for C-02 (Self-Issued Token Bypass)

**Files:**
- Modify: `packages/capability/test/lib.test.ts`

**Step 1: Write the failing test for self-issued token permission bypass**

Add to `packages/capability/test/lib.test.ts`:

```typescript
describe('checkCapability() - self-issued tokens (C-02)', () => {
  test('validates permissions even for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    // Alice creates a self-issued token claiming only 'read' permission
    const token = await alice.createToken({
      sub: alice.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    // Should succeed: requesting exactly what was granted
    await expect(
      checkCapability({ act: 'test/read', res: 'foo/bar' }, token.payload),
    ).resolves.not.toThrow()

    // Should FAIL: requesting 'write' when only 'read' was granted
    // BUG: Currently passes because iss === sub bypasses permission check
    await expect(
      checkCapability({ act: 'test/write', res: 'foo/bar' }, token.payload),
    ).rejects.toThrow()
  })

  test('validates resource even for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    const token = await alice.createToken({
      sub: alice.id,
      act: 'test/read',
      res: 'foo/bar',
    })

    // Should FAIL: requesting different resource
    await expect(
      checkCapability({ act: 'test/read', res: 'foo/baz' }, token.payload),
    ).rejects.toThrow()
  })

  test('respects wildcard permissions for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    const token = await alice.createToken({
      sub: alice.id,
      act: '*',
      res: 'foo/*',
    })

    // Should succeed: wildcard covers this
    await expect(
      checkCapability({ act: 'test/read', res: 'foo/bar' }, token.payload),
    ).resolves.not.toThrow()

    // Should fail: resource doesn't match wildcard
    await expect(
      checkCapability({ act: 'test/read', res: 'bar/baz' }, token.payload),
    ).rejects.toThrow()
  })

  test('requires act and res claims for self-issued tokens', async () => {
    const alice = randomTokenSigner()

    // Token without act/res claims
    const token = await alice.createToken({
      sub: alice.id,
    })

    await expect(
      checkCapability({ act: 'test/read', res: 'foo/bar' }, token.payload),
    ).rejects.toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: FAIL - "requesting 'write' when only 'read' was granted" should fail but currently passes

**Step 3: Commit test file**

```bash
git add packages/capability/test/lib.test.ts
git commit -m "test(capability): add failing tests for C-02 self-issued token bypass"
```

---

## Task 2: Fix C-02 - Self-Issued Token Permission Bypass

**Files:**
- Modify: `packages/capability/src/index.ts:169-183`

**Step 1: Understand the current bug**

Current code at lines 179-183:
```typescript
if (payload.iss === payload.sub) {
  // Subject is issuer, no delegation required
  assertNonExpired(payload, time)
  return  // BUG: Returns without checking permission!
}
```

**Step 2: Fix checkCapability to validate permissions for self-issued tokens**

Replace lines 169-199 in `packages/capability/src/index.ts`:

```typescript
export async function checkCapability(
  permission: Permission,
  payload: SignedPayload,
  atTime?: number,
): Promise<void> {
  if (payload.sub == null) {
    throw new Error('Invalid payload: no subject')
  }

  const time = atTime ?? now()

  if (payload.iss === payload.sub) {
    // Subject is issuer, no delegation required
    // But still need to validate the permission is granted
    assertNonExpired(payload, time)

    // Validate that the token grants the requested permission
    const tokenPermission = {
      act: (payload as { act?: string | Array<string> }).act,
      res: (payload as { res?: string | Array<string> }).res,
    }

    if (tokenPermission.act == null || tokenPermission.res == null) {
      throw new Error('Invalid payload: missing act or res for self-issued token')
    }

    if (!hasPermission(permission, tokenPermission as Permission)) {
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

  const toCapability = { ...payload, ...permission } as CapabilityPayload
  assertValidDelegation(capability.payload, toCapability, time)
  await checkDelegationChain(capability.payload, tail, time)
}
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "fix(capability)!: validate permissions for self-issued tokens (C-02)

BREAKING CHANGE: Self-issued tokens (iss === sub) now require act and res
claims that grant the requested permission. Previously, any self-issued
token was accepted regardless of its claims."
```

---

## Task 3: Write Failing Tests for H-04 (Delegation Chain Depth Limit)

**Files:**
- Modify: `packages/capability/test/lib.test.ts`

**Step 1: Write failing test for deep delegation chain DoS**

Add to `packages/capability/test/lib.test.ts`:

```typescript
describe('checkDelegationChain() - depth limits (H-04)', () => {
  test('rejects delegation chains exceeding max depth', async () => {
    const signers = Array.from({ length: 25 }, () => randomTokenSigner())

    // Build a chain of 24 delegations (exceeds default limit of 20)
    const capabilities: string[] = []
    for (let i = 0; i < signers.length - 1; i++) {
      const cap = await createCapability(signers[i], {
        sub: signers[0].id,
        aud: signers[i + 1].id,
        act: '*',
        res: '*',
      })
      capabilities.push(stringifyToken(cap))
    }

    const finalPayload = {
      iss: signers[signers.length - 1].id,
      sub: signers[0].id,
      act: 'test',
      res: 'foo',
    } as CapabilityPayload

    // Should reject: chain depth exceeds limit
    await expect(
      checkDelegationChain(finalPayload, capabilities.reverse()),
    ).rejects.toThrow('delegation chain exceeds maximum depth')
  })

  test('accepts delegation chains within max depth', async () => {
    const signers = Array.from({ length: 5 }, () => randomTokenSigner())

    const capabilities: string[] = []
    for (let i = 0; i < signers.length - 1; i++) {
      const cap = await createCapability(signers[i], {
        sub: signers[0].id,
        aud: signers[i + 1].id,
        act: '*',
        res: '*',
      })
      capabilities.push(stringifyToken(cap))
    }

    const finalPayload = {
      iss: signers[signers.length - 1].id,
      sub: signers[0].id,
      act: 'test',
      res: 'foo',
    } as CapabilityPayload

    // Should succeed: chain depth within limit
    await expect(
      checkDelegationChain(finalPayload, capabilities.reverse()),
    ).resolves.not.toThrow()
  })

  test('respects custom maxDepth option', async () => {
    const signers = Array.from({ length: 5 }, () => randomTokenSigner())

    const capabilities: string[] = []
    for (let i = 0; i < signers.length - 1; i++) {
      const cap = await createCapability(signers[i], {
        sub: signers[0].id,
        aud: signers[i + 1].id,
        act: '*',
        res: '*',
      })
      capabilities.push(stringifyToken(cap))
    }

    const finalPayload = {
      iss: signers[signers.length - 1].id,
      sub: signers[0].id,
      act: 'test',
      res: 'foo',
    } as CapabilityPayload

    // Should reject: custom limit of 2
    await expect(
      checkDelegationChain(finalPayload, capabilities.reverse(), undefined, { maxDepth: 2 }),
    ).rejects.toThrow('delegation chain exceeds maximum depth')

    // Should succeed: custom limit of 10
    await expect(
      checkDelegationChain(finalPayload, capabilities.reverse(), undefined, { maxDepth: 10 }),
    ).resolves.not.toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: FAIL - no depth limit exists yet

**Step 3: Commit test file**

```bash
git add packages/capability/test/lib.test.ts
git commit -m "test(capability): add failing tests for H-04 delegation chain depth"
```

---

## Task 4: Implement H-04 - Delegation Chain Depth Limit

**Files:**
- Modify: `packages/capability/src/index.ts`

**Step 1: Add configuration types and constants**

Add near top of `packages/capability/src/index.ts` (after imports):

```typescript
/** Default maximum delegation chain depth */
export const DEFAULT_MAX_DELEGATION_DEPTH = 20

/** Options for delegation chain validation */
export type DelegationChainOptions = {
  /** Maximum depth of delegation chain. Defaults to 20. */
  maxDepth?: number
}
```

**Step 2: Update checkDelegationChain to enforce depth limit**

Replace the `checkDelegationChain` function:

```typescript
export async function checkDelegationChain(
  payload: CapabilityPayload,
  capabilities: Array<string>,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DELEGATION_DEPTH

  if (capabilities.length > maxDepth) {
    throw new Error(
      `Invalid capability: delegation chain exceeds maximum depth of ${maxDepth}`,
    )
  }

  if (capabilities.length === 0) {
    if (payload.iss !== payload.sub) {
      throw new Error('Invalid capability: issuer should be subject')
    }
    assertNonExpired(payload, atTime)
    return
  }

  const [head, ...tail] = capabilities
  const next = await verifyToken<CapabilityPayload>(head)
  assertCapabilityToken(next)
  assertValidDelegation(next.payload, payload, atTime)
  await checkDelegationChain(next.payload, tail, atTime, options)
}
```

**Step 3: Update checkCapability to pass options through**

Update `checkCapability` signature and call:

```typescript
export async function checkCapability(
  permission: Permission,
  payload: SignedPayload,
  atTime?: number,
  options?: DelegationChainOptions,
): Promise<void> {
  // ... existing code ...

  // At the end, pass options to checkDelegationChain:
  await checkDelegationChain(capability.payload, tail, time, options)
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "feat(capability): add delegation chain depth limit (H-04)

Adds configurable maxDepth option (default: 20) to prevent stack overflow
DoS attacks via deeply nested delegation chains."
```

---

## Task 5: Write Failing Tests for M-04 (Type Validation)

**Files:**
- Modify: `packages/capability/test/lib.test.ts`

**Step 1: Write failing tests for capability token type checking**

Add to `packages/capability/test/lib.test.ts`:

```typescript
describe('isCapabilityToken() - type validation (M-04)', () => {
  test('rejects token with non-string aud', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: 'did:test:456',
        aud: 123, // Should be string
        act: 'test',
        res: 'foo',
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(false)
  })

  test('rejects token with non-string sub', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: { id: '456' }, // Should be string
        aud: 'did:test:789',
        act: 'test',
        res: 'foo',
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(false)
  })

  test('rejects token with invalid act type', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: 'did:test:456',
        aud: 'did:test:789',
        act: 123, // Should be string or string[]
        res: 'foo',
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(false)
  })

  test('rejects token with invalid res type', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: 'did:test:456',
        aud: 'did:test:789',
        act: 'test',
        res: { path: 'foo' }, // Should be string or string[]
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(false)
  })

  test('accepts token with string act and res', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: 'did:test:456',
        aud: 'did:test:789',
        act: 'test',
        res: 'foo',
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(true)
  })

  test('accepts token with array act and res', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: 'did:test:456',
        aud: 'did:test:789',
        act: ['read', 'write'],
        res: ['foo', 'bar'],
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(true)
  })

  test('rejects token with mixed array containing non-strings', () => {
    const token = {
      payload: {
        iss: 'did:test:123',
        sub: 'did:test:456',
        aud: 'did:test:789',
        act: ['read', 123], // Invalid: number in array
        res: 'foo',
      },
      verifiedPublicKey: new Uint8Array(32),
    }
    expect(isCapabilityToken(token)).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: FAIL - current code only checks for `!= null`, not type

**Step 3: Commit test file**

```bash
git add packages/capability/test/lib.test.ts
git commit -m "test(capability): add failing tests for M-04 type validation"
```

---

## Task 6: Implement M-04 - Improved Type Validation

**Files:**
- Modify: `packages/capability/src/index.ts`

**Step 1: Add helper functions for type validation**

Add before `isCapabilityToken`:

```typescript
function isStringOrStringArray(value: unknown): value is string | Array<string> {
  if (typeof value === 'string') {
    return true
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string')
  }
  return false
}
```

**Step 2: Update isCapabilityToken to validate types**

Replace the `isCapabilityToken` function:

```typescript
export function isCapabilityToken<Payload extends CapabilityPayload>(
  token: unknown,
): token is CapabilityToken<Payload> {
  if (!isVerifiedToken(token)) {
    return false
  }

  const payload = token.payload as Record<string, unknown>

  // Validate required string fields
  if (typeof payload.aud !== 'string') {
    return false
  }
  if (typeof payload.sub !== 'string') {
    return false
  }

  // Validate act and res are string or string[]
  if (!isStringOrStringArray(payload.act)) {
    return false
  }
  if (!isStringOrStringArray(payload.res)) {
    return false
  }

  return true
}
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "fix(capability): validate capability token field types (M-04)

isCapabilityToken() now validates that aud, sub are strings and
act, res are strings or string arrays."
```

---

## Task 7: Add Tests for createCapability Authorization (C-03)

**Files:**
- Modify: `packages/capability/test/lib.test.ts`

**Step 1: Write tests for capability delegation validation**

Add to `packages/capability/test/lib.test.ts`:

```typescript
describe('createCapability() - delegation validation (C-03)', () => {
  test('creates capability when signer is the subject (root capability)', async () => {
    const alice = randomTokenSigner()

    // Alice creates a capability for herself - always allowed
    const cap = await createCapability(alice, {
      sub: alice.id,
      aud: 'did:test:bob',
      act: 'test/read',
      res: 'foo/bar',
    })

    expect(cap.payload.iss).toBe(alice.id)
    expect(cap.payload.sub).toBe(alice.id)
  })

  test('creates capability with parent validation when delegating', async () => {
    const alice = randomTokenSigner()
    const bob = randomTokenSigner()

    // Alice creates root capability for Bob
    const rootCap = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: '*',
      res: 'foo/*',
    })

    // Bob can delegate to Carol with valid parent
    const carol = randomTokenSigner()
    const delegatedCap = await createCapability(
      bob,
      {
        sub: alice.id,
        aud: carol.id,
        act: 'test/read',
        res: 'foo/bar',
      },
      undefined,
      { parentCapability: stringifyToken(rootCap) },
    )

    expect(delegatedCap.payload.iss).toBe(bob.id)
    expect(delegatedCap.payload.sub).toBe(alice.id)
  })

  test('rejects delegation that exceeds parent permissions', async () => {
    const alice = randomTokenSigner()
    const bob = randomTokenSigner()

    const rootCap = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: 'test/read', // Only read
      res: 'foo/bar',
    })

    const carol = randomTokenSigner()

    // Bob tries to delegate 'write' which he doesn't have
    await expect(
      createCapability(
        bob,
        {
          sub: alice.id,
          aud: carol.id,
          act: 'test/write', // Exceeds parent
          res: 'foo/bar',
        },
        undefined,
        { parentCapability: stringifyToken(rootCap) },
      ),
    ).rejects.toThrow('permission')
  })

  test('rejects delegation when signer is not the parent audience', async () => {
    const alice = randomTokenSigner()
    const bob = randomTokenSigner()
    const eve = randomTokenSigner() // Attacker

    const rootCap = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: '*',
      res: '*',
    })

    // Eve tries to use Bob's capability
    await expect(
      createCapability(
        eve,
        {
          sub: alice.id,
          aud: 'did:test:victim',
          act: '*',
          res: '*',
        },
        undefined,
        { parentCapability: stringifyToken(rootCap) },
      ),
    ).rejects.toThrow('audience')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: FAIL - createCapability doesn't accept parentCapability option yet

**Step 3: Commit test file**

```bash
git add packages/capability/test/lib.test.ts
git commit -m "test(capability): add failing tests for C-03 delegation validation"
```

---

## Task 8: Implement C-03 - createCapability Delegation Validation

**Files:**
- Modify: `packages/capability/src/index.ts`

**Step 1: Add creation options type**

Add after `DelegationChainOptions`:

```typescript
/** Options for capability creation */
export type CreateCapabilityOptions = {
  /**
   * Parent capability token (stringified) that authorizes this delegation.
   * Required when creating a capability where signer is not the subject.
   * The signer must be the audience of the parent capability.
   */
  parentCapability?: string
}
```

**Step 2: Update createCapability to validate delegations**

Replace the `createCapability` function:

```typescript
export async function createCapability<
  Payload extends SignCapabilityPayload = SignCapabilityPayload,
  HeaderParams extends Record<string, unknown> = Record<string, unknown>,
>(
  signer: TokenSigner,
  payload: Payload,
  header?: HeaderParams,
  options?: CreateCapabilityOptions,
): Promise<CapabilityToken<Payload & { iss: string }, SignedHeader>> {
  const signerId = signer.id

  // If signer is the subject, no parent validation needed (root capability)
  if (payload.sub === signerId) {
    return await signer.createToken(payload, header)
  }

  // Signer is delegating on behalf of someone else - validate authorization
  if (options?.parentCapability == null) {
    throw new Error(
      'Invalid capability: parentCapability required when delegating for another subject',
    )
  }

  // Verify and validate the parent capability
  const parent = await verifyToken<CapabilityPayload>(options.parentCapability)
  assertCapabilityToken(parent)

  // Signer must be the audience of the parent capability
  if (parent.payload.aud !== signerId) {
    throw new Error(
      'Invalid capability: signer must be the audience of parent capability',
    )
  }

  // Subject must match
  if (parent.payload.sub !== payload.sub) {
    throw new Error('Invalid capability: subject mismatch with parent capability')
  }

  // Check parent is not expired
  assertNonExpired(parent.payload)

  // Check that the new capability doesn't exceed parent permissions
  const newPermission: Permission = {
    act: payload.act,
    res: payload.res,
  }
  const parentPermission: Permission = {
    act: parent.payload.act,
    res: parent.payload.res,
  }

  if (!hasPermission(newPermission, parentPermission)) {
    throw new Error(
      'Invalid capability: delegated permission exceeds parent capability',
    )
  }

  return await signer.createToken(payload, header)
}
```

**Step 3: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "feat(capability)!: add delegation validation to createCapability (C-03)

BREAKING CHANGE: createCapability() now requires a parentCapability option
when the signer is not the subject. This prevents unauthorized capability
delegation.

When signer === subject (root capability), no parent is needed.
When signer !== subject (delegation), parent must be provided and:
- Signer must be the audience of parent capability
- Subject must match parent's subject
- Delegated permissions must not exceed parent's permissions"
```

---

## Task 9: Export New Types from Package

**Files:**
- Modify: `packages/capability/src/index.ts`

**Step 1: Ensure all new exports are at the top of exports list**

The following should be exported (verify they're in the file):

```typescript
export {
  // Constants
  DEFAULT_MAX_DELEGATION_DEPTH,

  // Types
  type CreateCapabilityOptions,
  type DelegationChainOptions,

  // ... existing exports ...
}
```

**Step 2: Run full test suite**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "feat(capability): export new types and constants"
```

---

## Task 10: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 2: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 3: Build packages**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Final commit (if any fixes needed)**

```bash
git status
# If any uncommitted changes, commit them
```

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/capability/src/index.ts` | Modify | Fix C-02, C-03, H-04, M-04 |
| `packages/capability/test/lib.test.ts` | Modify | Add comprehensive security tests (34 tests total) |

## Deviations from Plan

1. **M-04 tests** use a `makeToken()` helper with realistic token shapes (`data`, `header`, `signature`, `verifiedPublicKey`) rather than the minimal stubs in the plan, because `isVerifiedToken()` validates these fields.
2. **H-04 tests** use a shared `buildDelegationChain()` helper that correctly passes `parentCapability` for delegated capabilities (required after C-03).
3. **`isCapabilityToken()`** also validates `iss` as a string (added during code review, not in original plan).
4. **`checkDelegationChain()`** signature changed from `(payload, capabilities, atTime?, options?)` to `(payload, capabilities, options?)` — the `atTime` parameter was moved into the `DelegationChainOptions` record (post-plan refactor).
5. **Existing tests** for `checkDelegationChain()` and `checkCapability()` were updated to pass `parentCapability` options, a necessary consequence of C-03.

## Breaking Changes

1. **`checkCapability()` now validates self-issued tokens** (C-02)
   - Tokens with `iss === sub` must now include `act` and `res` claims
   - The requested permission must be granted by the token's claims

2. **`createCapability()` requires parentCapability for delegations** (C-03)
   - When `signer.id !== payload.sub`, a `parentCapability` must be provided
   - Signer must be the audience of the parent capability
   - Delegated permissions cannot exceed parent's permissions

3. **`checkDelegationChain()` has new signature** (H-04 + refactor)
   - New optional `options` parameter with `atTime` and `maxDepth` (default: 20)
   - The `atTime` parameter moved from a positional argument into the options record
   - Chains exceeding max depth are rejected

4. **`checkCapability()` has new signature** (H-04)
   - New optional `options` parameter passed through to chain validation

## New Exports

- `DEFAULT_MAX_DELEGATION_DEPTH` - Constant (20)
- `DelegationChainOptions` - Type for chain validation options (includes `atTime` and `maxDepth`)
- `CreateCapabilityOptions` - Type for capability creation options
