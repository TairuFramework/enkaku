# Token Expiration Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement proper token expiration (`exp`), not-before (`nbf`), and issued-at (`iat`) validation in the `@enkaku/token` package.

**Architecture:** Add a validation function that checks time-based claims during token verification. The function will be called from `verifyToken()` after signature verification succeeds. This is a breaking change - tokens with expired `exp` claims that previously worked will now be rejected.

**Tech Stack:** TypeScript, Vitest for testing

**Related Issues from Security Audit:**
- C-01: Token expiration not validated (PRIMARY)
- H-01: Malformed token parsing - array bounds check (RELATED - same file)
- T-01: Token error path tests missing (TEST COVERAGE)

---

## Task 1: Add Token Part Count Validation (H-01)

**Files:**
- Modify: `packages/token/src/token.ts:113`
- Test: `packages/token/test/token.test.ts`

**Step 1: Write the failing test for malformed tokens**

Add to `packages/token/test/token.test.ts`:

```typescript
test('verifyToken rejects malformed JWT strings', async () => {
  // Too few parts
  await expect(verifyToken('header.payload')).rejects.toThrow('Invalid token format')
  await expect(verifyToken('header')).rejects.toThrow('Invalid token format')
  await expect(verifyToken('')).rejects.toThrow('Invalid token format')

  // Too many parts
  await expect(verifyToken('a.b.c.d')).rejects.toThrow('Invalid token format')
  await expect(verifyToken('a.b.c.d.e')).rejects.toThrow('Invalid token format')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: FAIL - current code doesn't validate part count

**Step 3: Implement token part count validation**

In `packages/token/src/token.ts`, replace line 113:

```typescript
// OLD:
const [encodedHeader, encodedPayload, signature] = token.split('.')

// NEW:
const parts = token.split('.')
if (parts.length !== 3) {
  throw new Error('Invalid token format: expected 3 parts separated by dots')
}
const [encodedHeader, encodedPayload, signature] = parts
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/token/src/token.ts packages/token/test/token.test.ts
git commit -m "fix(token): validate JWT string has exactly 3 parts (H-01)"
```

---

## Task 2: Create Time Validation Utility Function

**Files:**
- Create: `packages/token/src/time.ts`
- Modify: `packages/token/src/index.ts`

**Step 1: Create the time validation module**

Create `packages/token/src/time.ts`:

```typescript
/**
 * Get the current time in seconds since Unix epoch.
 */
export function now(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Options for time-based token validation.
 */
export type TimeValidationOptions = {
  /** Current time in seconds. Defaults to now(). */
  atTime?: number
  /** Clock skew tolerance in seconds. Defaults to 0. */
  clockTolerance?: number
}

/**
 * Payload with optional time-based claims.
 */
export type TimeClaimsPayload = {
  /** Expiration time (seconds since epoch) */
  exp?: number
  /** Not before time (seconds since epoch) */
  nbf?: number
  /** Issued at time (seconds since epoch) */
  iat?: number
}

/**
 * Validate time-based claims in a token payload.
 * @throws Error if token is expired or not yet valid
 */
export function assertTimeClaimsValid(
  payload: TimeClaimsPayload,
  options: TimeValidationOptions = {},
): void {
  const time = options.atTime ?? now()
  const tolerance = options.clockTolerance ?? 0

  if (payload.exp != null && payload.exp + tolerance < time) {
    throw new Error('Token expired')
  }

  if (payload.nbf != null && payload.nbf - tolerance > time) {
    throw new Error('Token not yet valid')
  }
}
```

**Step 2: Export from index**

Add to `packages/token/src/index.ts`:

```typescript
export {
  assertTimeClaimsValid,
  now,
  type TimeClaimsPayload,
  type TimeValidationOptions,
} from './time.js'
```

**Step 3: Commit**

```bash
git add packages/token/src/time.ts packages/token/src/index.ts
git commit -m "feat(token): add time validation utility functions"
```

---

## Task 3: Write Tests for Token Expiration Validation

**Files:**
- Create: `packages/token/test/time.test.ts`

**Step 1: Write comprehensive tests for time validation**

Create `packages/token/test/time.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { assertTimeClaimsValid, now } from '../src/time.js'

describe('now()', () => {
  test('returns current time in seconds', () => {
    const before = Math.floor(Date.now() / 1000)
    const result = now()
    const after = Math.floor(Date.now() / 1000)
    expect(result).toBeGreaterThanOrEqual(before)
    expect(result).toBeLessThanOrEqual(after)
  })
})

describe('assertTimeClaimsValid()', () => {
  const fixedTime = 1700000000 // Fixed timestamp for testing

  describe('exp (expiration) claim', () => {
    test('accepts token without exp claim', () => {
      expect(() => assertTimeClaimsValid({}, { atTime: fixedTime })).not.toThrow()
    })

    test('accepts token with future exp', () => {
      expect(() =>
        assertTimeClaimsValid({ exp: fixedTime + 3600 }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('accepts token with exp equal to current time', () => {
      // exp is "at or after" - equal should pass
      expect(() =>
        assertTimeClaimsValid({ exp: fixedTime }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('rejects token with past exp', () => {
      expect(() =>
        assertTimeClaimsValid({ exp: fixedTime - 1 }, { atTime: fixedTime }),
      ).toThrow('Token expired')
    })

    test('respects clockTolerance for exp', () => {
      // Expired by 5 seconds, but tolerance is 10
      expect(() =>
        assertTimeClaimsValid(
          { exp: fixedTime - 5 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).not.toThrow()

      // Expired by 15 seconds, tolerance is 10 - should fail
      expect(() =>
        assertTimeClaimsValid(
          { exp: fixedTime - 15 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).toThrow('Token expired')
    })
  })

  describe('nbf (not before) claim', () => {
    test('accepts token without nbf claim', () => {
      expect(() => assertTimeClaimsValid({}, { atTime: fixedTime })).not.toThrow()
    })

    test('accepts token with past nbf', () => {
      expect(() =>
        assertTimeClaimsValid({ nbf: fixedTime - 3600 }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('accepts token with nbf equal to current time', () => {
      expect(() =>
        assertTimeClaimsValid({ nbf: fixedTime }, { atTime: fixedTime }),
      ).not.toThrow()
    })

    test('rejects token with future nbf', () => {
      expect(() =>
        assertTimeClaimsValid({ nbf: fixedTime + 1 }, { atTime: fixedTime }),
      ).toThrow('Token not yet valid')
    })

    test('respects clockTolerance for nbf', () => {
      // nbf is 5 seconds in future, but tolerance is 10
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime + 5 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).not.toThrow()

      // nbf is 15 seconds in future, tolerance is 10 - should fail
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime + 15 },
          { atTime: fixedTime, clockTolerance: 10 },
        ),
      ).toThrow('Token not yet valid')
    })
  })

  describe('combined claims', () => {
    test('validates both exp and nbf', () => {
      // Valid window: nbf in past, exp in future
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime - 100, exp: fixedTime + 100 },
          { atTime: fixedTime },
        ),
      ).not.toThrow()
    })

    test('exp failure takes precedence', () => {
      expect(() =>
        assertTimeClaimsValid(
          { nbf: fixedTime - 100, exp: fixedTime - 1 },
          { atTime: fixedTime },
        ),
      ).toThrow('Token expired')
    })

    test('iat claim is ignored (informational only)', () => {
      // iat in future should not cause validation to fail
      expect(() =>
        assertTimeClaimsValid({ iat: fixedTime + 1000 }, { atTime: fixedTime }),
      ).not.toThrow()
    })
  })

  describe('uses current time by default', () => {
    test('uses now() when atTime not provided', () => {
      const futureExp = now() + 3600
      expect(() => assertTimeClaimsValid({ exp: futureExp })).not.toThrow()

      const pastExp = now() - 3600
      expect(() => assertTimeClaimsValid({ exp: pastExp })).toThrow('Token expired')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: FAIL - time.ts doesn't exist yet

**Step 3: Verify tests pass after Task 2 implementation**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: PASS (assuming Task 2 was completed)

**Step 4: Commit**

```bash
git add packages/token/test/time.test.ts
git commit -m "test(token): add comprehensive time validation tests"
```

---

## Task 4: Integrate Time Validation into verifyToken

**Files:**
- Modify: `packages/token/src/token.ts`
- Modify: `packages/token/test/token.test.ts`

**Step 1: Write integration tests**

Add to `packages/token/test/token.test.ts`:

```typescript
import { randomTokenSigner, verifyToken, type TimeValidationOptions } from '../src/index.js'

describe('verifyToken with time validation', () => {
  const fixedTime = 1700000000

  test('rejects expired signed token', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      exp: fixedTime - 100
    })

    await expect(
      verifyToken(token, undefined, { atTime: fixedTime })
    ).rejects.toThrow('Token expired')
  })

  test('rejects token not yet valid (nbf in future)', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      nbf: fixedTime + 100
    })

    await expect(
      verifyToken(token, undefined, { atTime: fixedTime })
    ).rejects.toThrow('Token not yet valid')
  })

  test('accepts token within valid time window', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      nbf: fixedTime - 100,
      exp: fixedTime + 100,
    })

    const result = await verifyToken(token, undefined, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('accepts token without time claims', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({ test: true })

    const result = await verifyToken(token, undefined, { atTime: fixedTime })
    expect(result.payload.test).toBe(true)
  })

  test('respects clockTolerance option', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      exp: fixedTime - 5 // Expired 5 seconds ago
    })

    // Should fail without tolerance
    await expect(
      verifyToken(token, undefined, { atTime: fixedTime })
    ).rejects.toThrow('Token expired')

    // Should pass with 10 second tolerance
    const result = await verifyToken(token, undefined, {
      atTime: fixedTime,
      clockTolerance: 10
    })
    expect(result.payload.test).toBe(true)
  })

  test('validates time claims for JWT string tokens', async () => {
    const signer = randomTokenSigner()
    const token = await signer.createToken({
      test: true,
      exp: fixedTime - 100
    })
    const tokenString = stringifyToken(token)

    await expect(
      verifyToken(tokenString, undefined, { atTime: fixedTime })
    ).rejects.toThrow('Token expired')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: FAIL - verifyToken doesn't accept time options yet

**Step 3: Update verifyToken signature and implementation**

Modify `packages/token/src/token.ts`:

```typescript
// Add import at top
import { assertTimeClaimsValid, type TimeValidationOptions } from './time.js'

// Update verifyToken function signature and implementation
/**
 * Verify a token is either unsigned or signed with a valid signature.
 * Also validates time-based claims (exp, nbf) if present.
 */
export async function verifyToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(
  token: Token<Payload> | string,
  verifiers?: Verifiers,
  timeOptions?: TimeValidationOptions,
): Promise<Token<Payload>> {
  if (typeof token !== 'string') {
    if (isUnsignedToken(token)) {
      return token
    }
    if (isVerifiedToken(token)) {
      // Validate time claims even for already-verified tokens
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      return token
    }
    if (isSignedToken(token)) {
      const verifiedPublicKey = await verifySignedPayload(
        fromB64U(token.signature),
        token.payload,
        token.data,
        verifiers,
      )
      // Validate time claims after signature verification
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      return { ...token, verifiedPublicKey } as Token<Payload>
    }
    throw new Error('Unsupported token')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format: expected 3 parts separated by dots')
  }
  const [encodedHeader, encodedPayload, signature] = parts

  const header = b64uToJSON(encodedHeader)
  if (header.typ !== 'JWT') {
    throw new Error(`Invalid token header type: ${header.typ}`)
  }
  if (header.alg === 'none') {
    return { header, payload: b64uToJSON<Payload>(encodedPayload) } as UnsignedToken<Payload>
  }

  if (isType(validateAlgorithm, header.alg)) {
    if (signature == null) {
      throw new Error('Missing signature for token with signed header')
    }

    const payload = b64uToJSON<Payload>(encodedPayload)
    const data = `${encodedHeader}.${encodedPayload}`
    const verifiedPublicKey = await verifySignedPayload(
      fromB64U(signature),
      payload,
      data,
      verifiers,
    )
    // Validate time claims after signature verification
    assertTimeClaimsValid(payload as Record<string, unknown>, timeOptions)
    return {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as Token<Payload>
  }

  throw new Error(`Unsupported signature algorithm: ${header.alg}`)
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/token/src/token.ts packages/token/test/token.test.ts
git commit -m "feat(token)!: add time validation to verifyToken (C-01)

BREAKING CHANGE: Tokens with expired 'exp' claim or future 'nbf' claim
are now rejected by verifyToken(). Use the new timeOptions parameter
to configure clockTolerance if needed."
```

---

## Task 5: Export Time Types from Package

**Files:**
- Modify: `packages/token/src/index.ts`

**Step 1: Ensure all new exports are available**

Update `packages/token/src/index.ts` to include:

```typescript
export {
  assertTimeClaimsValid,
  now,
  type TimeClaimsPayload,
  type TimeValidationOptions,
} from './time.js'
```

**Step 2: Run full test suite**

Run: `pnpm --filter @enkaku/token test:unit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/token/src/index.ts
git commit -m "feat(token): export time validation types"
```

---

## Task 6: Update Capability Package to Use Token Time Validation

**Files:**
- Modify: `packages/capability/src/index.ts`
- Modify: `packages/capability/test/lib.test.ts`

**Step 1: Write test for capability time validation integration**

Add to `packages/capability/test/lib.test.ts`:

```typescript
describe('time validation integration', () => {
  const fixedTime = 1700000000

  test('checkCapability rejects expired capability token', async () => {
    const alice = randomTokenSigner()
    const bob = randomTokenSigner()

    // Create an expired capability
    const capability = await createCapability(alice, {
      sub: alice.id,
      aud: bob.id,
      act: 'test/read',
      res: 'foo/bar',
      exp: fixedTime - 100, // Expired
    })

    const bobToken = await bob.createToken({
      sub: alice.id,
      act: 'test/read',
      res: 'foo/bar',
      cap: stringifyToken(capability),
    })

    await expect(
      checkCapability(
        { act: 'test/read', res: 'foo/bar' },
        bobToken.payload,
        fixedTime,
      )
    ).rejects.toThrow('Invalid token: expired')
  })
})
```

**Step 2: Run test to verify behavior**

Run: `pnpm --filter @enkaku/capability test:unit`
Expected: This should already pass since capability uses `assertNonExpired()` internally.

**Step 3: Verify existing tests still pass**

Run: `pnpm test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/capability/test/lib.test.ts
git commit -m "test(capability): add time validation integration tests"
```

---

## Task 7: Run Full Test Suite and Verify

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
| `packages/token/src/time.ts` | Create | Time validation utility functions |
| `packages/token/src/token.ts` | Modify | Add time validation, fix JWT part count |
| `packages/token/src/index.ts` | Modify | Export new time validation types |
| `packages/token/test/time.test.ts` | Create | Comprehensive time validation tests |
| `packages/token/test/token.test.ts` | Modify | Add integration tests |
| `packages/capability/test/lib.test.ts` | Modify | Add integration test |

## Breaking Changes

1. **`verifyToken()` now validates time claims** - Tokens with:
   - `exp` in the past will throw "Token expired"
   - `nbf` in the future will throw "Token not yet valid"

2. **New third parameter** - `verifyToken(token, verifiers?, timeOptions?)` accepts optional `TimeValidationOptions`:
   - `atTime?: number` - Override current time (useful for testing)
   - `clockTolerance?: number` - Allow clock skew in seconds
