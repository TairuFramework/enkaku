# Token Verification Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two critical verification bypasses in `@enkaku/token` (signature/payload decoupling on object-form tokens, inbound `verifiedPublicKey` trust) and reject malleable ES256 signatures.

**Architecture:** All changes live in `packages/token/src/token.ts` and `packages/token/src/verifier.ts`. Object-form tokens get their verified bytes recomputed (or binding-checked) from `header` + `payload` so the signature always authenticates the payload used for authorization. The "already verified" fast path moves from a data-driven property check to a module-private `WeakSet` brand that deserialized JSON can never satisfy.

**Tech Stack:** TypeScript, vitest, `@noble/curves`, `@enkaku/codec` (canonical JSON).

**Background (read before starting):**
- Signers build `data = b64uFromJSON(header) + '.' + b64uFromJSON(payload)` with canonical JSON (`packages/token/src/identity.ts:103,367`; `b64uFromJSON` canonicalizes by default, `packages/codec/src/index.ts:98-99`). So recomputing `data` from a JSON-round-tripped token byte-matches what was signed.
- The vulnerable path: `verifyTokenInner` object branch (`packages/token/src/token.ts:142-153`) passes the wire-supplied `token.data` to `verifySignedPayload`, which verifies the signature over it (`token.ts:61-62`) while authorization later uses `token.payload`. Nothing ties the two together.
- The bypass: `verifyTokenInner` (`token.ts:138-141`) returns early with no signature check when `token.verifiedPublicKey != null`, and `isVerifiedToken` (`token.ts:98-102`) only checks property presence — satisfiable by attacker JSON when the server runs without a protocol validator.
- The only external consumer of `isVerifiedToken` is `packages/capability/src/index.ts:144`, and capability always calls it on the object **returned by** `verifyToken` (index.ts:209-210, 344-349, 399-404), so the WeakSet brand works there unchanged.

---

### Task 1: Bind signature to header + payload for object-form tokens

**Files:**
- Modify: `packages/token/src/token.ts:1` (imports), `token.ts:142-153` (object branch), new helper above `verifyTokenInner`
- Test: `packages/token/test/token.test.ts`

- [ ] **Step 1: Write the failing attack test**

Add to `packages/token/test/token.test.ts` (imports `randomIdentity`, `verifyToken`, `isVerifiedToken`, `b64uFromJSON` already present; add `toB64U` and `fromUTF` to the `@enkaku/codec` import):

```ts
describe('object token signature/payload binding', () => {
  test('rejects object tokens whose data does not match the payload', async () => {
    const victim = randomIdentity()
    const attacker = randomIdentity()
    // any token signed by the victim, e.g. a capability delegated to the attacker
    const original = await victim.signToken({ aud: attacker.id, cap: 'kv/read' })
    // attacker reuses the victim's signature with an arbitrary payload
    const forged = {
      header: original.header,
      payload: { iss: victim.id, aud: attacker.id, cap: 'kv/admin' },
      signature: original.signature,
      data: original.data,
    }
    await expect(verifyToken(forged)).rejects.toThrow('data does not match')
  })

  test('verifies object tokens after JSON round-trip', async () => {
    const identity = randomIdentity()
    const signed = await identity.signToken({ test: 1, nested: { b: 2, a: 1 } })
    const wire = JSON.parse(JSON.stringify(signed))
    const verified = await verifyToken(wire)
    expect(isVerifiedToken(verified)).toBe(true)
  })

  test('verifies object tokens without a data field', async () => {
    const identity = randomIdentity()
    const signed = await identity.signToken({ test: true })
    const { data: _data, ...withoutData } = signed
    const verified = await verifyToken(withoutData as typeof signed)
    expect(isVerifiedToken(verified)).toBe(true)
  })

  test('accepts data using a different serialization of the same payload', async () => {
    const identity = randomIdentity()
    const header = { typ: 'JWT', alg: 'EdDSA' }
    // non-canonical key order: JSON.stringify preserves insertion order (iss, b, a)
    const payload = { iss: identity.id, b: 2, a: 1 }
    const data = `${b64uFromJSON(header, false)}.${b64uFromJSON(payload, false)}`
    const signature = toB64U(ed25519.sign(fromUTF(data), identity.privateKey))
    const token = { header, payload, signature, data }
    const verified = await verifyToken(token as Parameters<typeof verifyToken>[0])
    expect(isVerifiedToken(verified)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests, confirm the attack test FAILS**

Run: `pnpm --filter @enkaku/token run test:unit -- token.test.ts`
Expected: `rejects object tokens whose data does not match the payload` FAILS (the forged token currently verifies — this is the vulnerability). The three acceptance tests should PASS already (round-trip and non-canonical pass via the supplied `data`; the no-`data` test FAILS today too — `verify` receives `undefined`).

- [ ] **Step 3: Implement the binding**

In `packages/token/src/token.ts`, update the codec import (line 1):

```ts
import { b64uFromJSON, b64uToJSON, canonicalStringify, fromB64U, fromUTF } from '@enkaku/codec'
```

Add above `verifyTokenInner`:

```ts
function getVerifiableData(token: SignedToken<Record<string, unknown>>): string {
  const recomputed = `${b64uFromJSON(token.header)}.${b64uFromJSON(token.payload)}`
  const data = token.data
  if (data == null || data === recomputed) {
    return recomputed
  }
  // `data` may use a different JSON serialization of the same header and payload.
  // Accept it only if it decodes to exactly the same values, so the signed bytes
  // can never be decoupled from the payload used for authorization.
  const parts = data.split('.')
  if (parts.length === 2) {
    try {
      if (
        canonicalStringify(b64uToJSON(parts[0])) === canonicalStringify(token.header) &&
        canonicalStringify(b64uToJSON(parts[1])) === canonicalStringify(token.payload)
      ) {
        return data
      }
    } catch {
      // invalid base64url or JSON in data: fall through to the error below
    }
  }
  throw new Error('Invalid token: data does not match header and payload')
}
```

Replace the object branch of `verifyTokenInner` (`token.ts:142-153`):

```ts
    if (isSignedToken(token)) {
      const data = getVerifiableData(token)
      const verifiedPublicKey = await verifySignedPayload({
        signature: fromB64U(token.signature),
        payload: token.payload,
        header: token.header as { alg?: string; kid?: string },
        data,
        verifiers,
        resolver,
        cache,
      })
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      return { ...token, data, verifiedPublicKey } as Token<Payload>
    }
```

`SignedToken` is already imported as a type (`token.ts:16`).

- [ ] **Step 4: Run the tests, confirm all PASS**

Run: `pnpm --filter @enkaku/token run test:unit -- token.test.ts`
Expected: all PASS, including all pre-existing tests in the file.

- [ ] **Step 5: Run the full token suite and type check**

Run: `pnpm --filter @enkaku/token run test`
Expected: PASS (types + unit).

- [ ] **Step 6: Commit**

```bash
git add packages/token/src/token.ts packages/token/test/token.test.ts
git commit -m "fix(token): bind signature verification to header and payload for object tokens"
```

---

### Task 2: Replace inbound `verifiedPublicKey` trust with a WeakSet brand

**Files:**
- Modify: `packages/token/src/token.ts:98-102` (`isVerifiedToken`), `verifyTokenInner` object + string branches
- Test: `packages/token/test/token.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/token/test/token.test.ts`:

```ts
describe('verified token branding', () => {
  test('isVerifiedToken rejects deserialized tokens carrying verifiedPublicKey', async () => {
    const identity = randomIdentity()
    const signed = await identity.signToken({ test: true })
    const verified = await verifyToken(signed)
    expect(isVerifiedToken(verified)).toBe(true)
    // round-trip through JSON, as a wire message would arrive
    const wire = JSON.parse(JSON.stringify(verified))
    expect(isVerifiedToken(wire)).toBe(false)
  })

  test('verifyToken re-verifies tokens carrying an inbound verifiedPublicKey', async () => {
    const victim = randomIdentity()
    const attacker = randomIdentity()
    const signed = await victim.signToken({ test: true })
    // forged payload, victim signature, attacker-injected verifiedPublicKey
    const forged = {
      header: signed.header,
      payload: { ...signed.payload, admin: true },
      signature: signed.signature,
      data: signed.data,
      verifiedPublicKey: new Uint8Array(32),
    }
    await expect(verifyToken(forged)).rejects.toThrow()
  })

  test('deserialized token with verifiedPublicKey still verifies when genuine', async () => {
    const identity = randomIdentity()
    const verified = await verifyToken(await identity.signToken({ test: true }))
    const wire = JSON.parse(JSON.stringify(verified))
    const reverified = await verifyToken(wire)
    expect(isVerifiedToken(reverified)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests, confirm they FAIL**

Run: `pnpm --filter @enkaku/token run test:unit -- token.test.ts`
Expected: test 1 FAILS (`isVerifiedToken(wire)` returns `true` today), test 2 FAILS (forged token resolves instead of rejecting — `verifiedPublicKey` short-circuits verification), test 3 PASSES today (short-circuit accepts it) — it exists to stay green after the fix.

- [ ] **Step 3: Implement the brand**

In `packages/token/src/token.ts`, add below the imports (after line 19):

```ts
// Tokens whose signature was verified in this process. Deserialized JSON can carry a
// `verifiedPublicKey` property but can never be a member of this set, so verification
// is only ever skipped for objects produced by `verifyToken` itself.
const verifiedTokens = new WeakSet<object>()
```

Replace `isVerifiedToken` (`token.ts:98-102`):

```ts
/**
 * Check if a token was verified by `verifyToken` in this process.
 * A `verifiedPublicKey` property on a deserialized token is never trusted.
 */
export function isVerifiedToken<Payload extends SignedPayload>(
  token: unknown,
): token is VerifiedToken<Payload> {
  return (
    isSignedToken(token) &&
    (token as VerifiedToken<Payload>).verifiedPublicKey != null &&
    verifiedTokens.has(token as object)
  )
}
```

In `verifyTokenInner`, the `isVerifiedToken(token)` early return (`token.ts:138-141`) stays as is — it is now reachable only for in-process verified objects. Register results in both verification paths. Object branch (end of the Task 1 code):

```ts
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      const result = { ...token, data, verifiedPublicKey } as Token<Payload>
      verifiedTokens.add(result)
      return result
```

String branch (`token.ts:189-195`):

```ts
    const result = {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as Token<Payload>
    verifiedTokens.add(result)
    return result
```

- [ ] **Step 4: Run the token tests**

Run: `pnpm --filter @enkaku/token run test:unit`
Expected: all PASS. If a pre-existing test constructs a `VerifiedToken` literal and expects `isVerifiedToken` to accept it, route it through `verifyToken` instead — the new semantics are intentional.

- [ ] **Step 5: Run the capability package tests (external isVerifiedToken consumer)**

Run: `pnpm --filter @enkaku/capability run test:unit`
Expected: PASS — capability calls `isCapabilityToken`/`isVerifiedToken` on objects returned by `verifyToken` (`packages/capability/src/index.ts:209-210,344-349,399-404`). If any path fails, it is passing a pre-verification object; fix the call site to use the `verifyToken` result.

- [ ] **Step 6: Commit**

```bash
git add packages/token/src/token.ts packages/token/test/token.test.ts
git commit -m "fix(token): never trust inbound verifiedPublicKey, brand verified tokens in-process"
```

---

### Task 3: Reject malleable high-S ES256 signatures

**Files:**
- Modify: `packages/token/src/verifier.ts:18-20`
- Test: `packages/token/test/sign-verify.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/token/test/sign-verify.test.ts` (file already imports `p256` and `getVerifier`; add `import { equals } from 'uint8arrays'` if not present):

```ts
test('ES256 rejects malleable high-S signatures', async () => {
  const { publicKey, secretKey } = p256.keygen()
  const verify = getVerifier('ES256')
  // RFC 6979 nonces are deterministic per message; ~half of messages produce a
  // high-S signature when lowS normalization is disabled. Find one.
  for (let i = 0; i < 256; i++) {
    const message = new TextEncoder().encode(`malleability-${i}`)
    const lowS = p256.sign(message, secretKey, { lowS: true })
    const maybeHighS = p256.sign(message, secretKey, { lowS: false })
    if (!equals(lowS, maybeHighS)) {
      expect(await verify(lowS, message, publicKey)).toBe(true)
      expect(await verify(maybeHighS, message, publicKey)).toBe(false)
      return
    }
  }
  throw new Error('no high-S signature found in 256 attempts')
})
```

- [ ] **Step 2: Run it, confirm FAIL**

Run: `pnpm --filter @enkaku/token run test:unit -- sign-verify.test.ts`
Expected: FAIL — `verify(maybeHighS, ...)` returns `true` with `lowS: false`.

- [ ] **Step 3: Implement**

In `packages/token/src/verifier.ts:18-20`:

```ts
  ES256: (signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array) => {
    return p256.verify(signature, message, publicKey, { lowS: true })
  },
```

- [ ] **Step 4: Run it, confirm PASS**

Run: `pnpm --filter @enkaku/token run test:unit -- sign-verify.test.ts`
Expected: PASS, including the pre-existing `ES256 low-level signature` test (noble signs low-S by default).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/verifier.ts packages/token/test/sign-verify.test.ts
git commit -m "fix(token): reject malleable high-S ES256 signatures"
```

---

### Task 4: Cross-package verification sweep

**Files:** none created — verification only.

- [ ] **Step 1: Run dependent package suites**

Run: `pnpm --filter @enkaku/token run test && pnpm --filter @enkaku/capability run test && pnpm --filter @enkaku/server run test && pnpm --filter @enkaku/group run test`
Expected: all PASS. Server auth paths (`packages/server/src/server.ts:443-519`) and group capability checks call `verifyToken` with wire-shaped object tokens — they exercise the new binding end to end.

- [ ] **Step 2: Run integration tests**

Run: `pnpm run test:unit --filter=...` is turbo-wide; instead run the root suite: `pnpm run test`
Expected: PASS across the workspace (type checks + unit + integration).

- [ ] **Step 3: Lint**

Run: `rtk proxy pnpm run lint`
Expected: no errors.

- [ ] **Step 4: Final commit (if lint touched files)**

```bash
git add -A
git commit -m "chore: lint after token verification hardening"
```

Only commit if lint modified files; otherwise skip.
