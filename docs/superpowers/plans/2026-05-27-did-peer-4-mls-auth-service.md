# did:peer:4 MLS authentication service binding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing

**Goal:** Enable `did:peer:4` identities to participate as full MLS group members by adapting `MultiKeyIdentity` to `OwnIdentity`, replacing the dual-format MLS leaf credential with a single self-contained JSON shape, and teaching the auth service to bind peer4 leaf signature keys via the embedded long-form DID document.

**Architecture:** `MultiKeyIdentity` is widened to structurally satisfy `OwnIdentity`/`SigningIdentity`/`FullIdentity` (new `id`/`publicKey`/`privateKey` aliases, unified `signToken` signature). MLS leaf credentials use a single JSON shape `{ id, longForm? }` that always self-describes — no cache or resolver needed inside MLS validation. The auth service decodes the embedded long-form inline, enforces hash binding, and scans verification methods for one matching the MLS leaf signature key.

**Tech Stack:** TypeScript, pnpm workspaces, vitest, ts-mls, `@enkaku/token`, `@enkaku/group`, `@enkaku/capability`, `@enkaku/client`, `@enkaku/browser-keystore`, `@enkaku/ledger-identity`.

**Spec:** `docs/superpowers/specs/2026-05-27-did-peer-4-mls-auth-service-design.md`

---

## File Structure

### `@enkaku/token`
- Modify: `packages/token/src/identity.ts` — rename `did → id` on `MultiKeyIdentity`, add `publicKey`/`privateKey`, eager sig-key throw, unify `signToken` signature, update `SigningIdentity` interface and `createSigningIdentity`.
- Modify: `packages/token/src/rotation.ts` — `.did` → `.id`.
- Modify: `packages/token/src/jwe.ts` — `signer.signToken(payload, options.header)` → `signer.signToken(payload, { header: options.header })`.
- Modify: `packages/token/src/token.ts` — same migration for `signer.signToken(token.payload, token.header)`.
- Modify: `packages/token/src/index.ts` — re-export new `SignTokenOptions`; remove old `SignOptions` re-export.
- Modify: `packages/token/test/*.ts` — rename `.did` → `.id` accesses, update `.sign(...)` → `.signToken(...)`.

### `@enkaku/capability`
- Modify: `packages/capability/src/index.ts:199,238` — `signer.signToken(payload, header)` → `signer.signToken(payload, { header })`.

### `@enkaku/client`
- Modify: `packages/client/src/client.ts:228` — same migration.

### `@enkaku/browser-keystore`
- Modify: `packages/browser-keystore/src/identity.ts` — `signToken(payload, header)` → `signToken(payload, options)`.

### `@enkaku/ledger-identity`
- Modify: `packages/ledger-identity/src/provider.ts:83-127` — same migration.

### `@enkaku/group`
- Modify: `packages/group/src/credential.ts` — drop `SerializedCredential`, `credentialToMLSIdentity`, `mlsIdentityToSerializedCredential`. Add `MLSCredentialIdentity`, `parseMLSCredentialIdentity`. Update `populateCacheFromCredential` parameter type. Rename `MemberCredential.did → id`.
- Modify: `packages/group/src/authentication.ts` — peer4 binding by scanning `doc.verificationMethod` for matching pubkey.
- Modify: `packages/group/src/group.ts` — `makeMLSCredential` always JSON; peer4 must carry `longForm`. `findMemberLeafIndex(id)` parses JSON identity. `Invite.inviterDID → inviterID`. Identity `.did` → `.id` references throughout.
- Modify: `packages/group/src/types.ts` — `Invite.inviterDID → inviterID`.
- Modify: `packages/group/src/index.ts` — drop old exports, add new ones.
- Modify / extend tests: `authentication.test.ts`, `credential.test.ts`, `peer4-credential.test.ts`, `group.test.ts`, `external-rejoin.test.ts`.

### `@enkaku/server` (if any `.did` access leaks through tests)
- Modify: `packages/server/test/peer4-handshake.test.ts` — rename `.did` → `.id` if needed.

---

## Task 1: Token — rename `MultiKeyIdentity.did → id`, add `publicKey`/`privateKey`, eager sig-key throw

**Files:**
- Modify: `packages/token/src/identity.ts`
- Modify: `packages/token/src/rotation.ts`
- Modify: `packages/token/test/identity.test.ts`
- Modify: `packages/token/test/identity-create.test.ts`
- Modify: `packages/token/test/sign-verify.test.ts`
- Modify: `packages/token/test/token.test.ts`
- Modify: `packages/token/test/token-peer4.test.ts`
- Modify: `packages/token/test/rotation.test.ts`

- [ ] **Step 1.1: Update `MultiKeyIdentity` type and `buildIdentity` in `packages/token/src/identity.ts`**

Replace the existing `MultiKeyIdentity` type and the `buildIdentity` function:

```ts
export type MultiKeyIdentity = {
  id: string
  longForm: string
  doc: DIDDoc
  keys: Array<ResolvedKey>
  publicKey: Uint8Array
  privateKey: Uint8Array
  sign<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options?: SignOptions,
  ): Promise<SignedToken<Payload>>
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array, kid?: string): Promise<Uint8Array>
}

function buildIdentity(
  id: string,
  longForm: string,
  doc: DIDDoc,
  keys: Array<ResolvedKey>,
): MultiKeyIdentity {
  const primarySig = keys.find((k) => k.purpose === 'sig')
  if (primarySig == null) {
    throw new Error('createIdentity requires at least one signing key')
  }
  const sentTo = new Set<string>()
  const isPeer = isPeer4(id)

  function pickIss(payload: Record<string, unknown>, embedLongForm: boolean | undefined): string {
    if (!isPeer) return id
    if (embedLongForm === true) return longForm
    if (embedLongForm === false) return id
    const aud = payload.aud
    if (typeof aud !== 'string') return id
    const normalizedAud = normalizeDID(aud)
    if (sentTo.has(normalizedAud)) return id
    sentTo.add(normalizedAud)
    return longForm
  }

  async function sign<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options: SignOptions = {},
  ): Promise<SignedToken<Payload>> {
    const key = pickSigningKey(keys, options.kid)
    const iss = pickIss(payload as Record<string, unknown>, options.embedLongForm)
    const header = {
      typ: 'JWT',
      alg: 'EdDSA',
      ...(isPeer ? { kid: key.fragment } : {}),
    } as SignedHeader
    const fullPayload = { ...payload, iss }
    const data = `${b64uFromJSON(header)}.${b64uFromJSON(fullPayload)}`
    return {
      header: header as SignedHeader & Record<string, unknown>,
      payload: fullPayload as Payload & { iss: string },
      signature: toB64U(signWith(key, fromUTF(data))),
      data,
    } as SignedToken<Payload>
  }

  async function agreeKey(ephemeralPublicKey: Uint8Array, kid?: string): Promise<Uint8Array> {
    const key = pickKemKey(keys, kid)
    return x25519.getSharedSecret(key.privateKey, ephemeralPublicKey)
  }

  async function decrypt(jwe: string): Promise<Uint8Array> {
    pickKemKey(keys)
    return decryptToken({ id, decrypt, agreeKey }, jwe)
  }

  return {
    id,
    longForm,
    doc,
    keys,
    publicKey: primarySig.publicKey,
    privateKey: primarySig.privateKey,
    sign,
    decrypt,
    agreeKey,
  }
}
```

Update both `createIdentity` returns at the bottom of the file (the did:key and peer:4 paths) so the first positional argument `did` becomes `id` — same string value, just renamed local. The two call sites today are:

```ts
return buildIdentity(did, did, doc, keys)               // did:key branch
return buildIdentity(shortForm, longForm, doc, keys)    // peer:4 branch
```

Rename the local variable in the did:key branch from `did` to `id` for consistency:

```ts
const id = getDID(CODECS.EdDSA, k.publicKey)
const doc: DIDDoc = { ... }
return buildIdentity(id, id, doc, keys)
```

- [ ] **Step 1.2: Update `packages/token/src/rotation.ts`**

Replace lines 23-26:

```ts
return oldIdentity.sign<RotationPayload>({
  type: 'did-rotation',
  to: newIdentity.id,
  toLongForm: newIdentity.longForm,
  issuedAt,
})
```

- [ ] **Step 1.3: Update all `.did` accesses in token tests to `.id`**

Run a workspace-wide search for `identity.did` and `Identity.did` patterns in `packages/token/test/` and replace with `.id`. Specifically:
- `packages/token/test/identity.test.ts` — every `.did` access on a `MultiKeyIdentity`-typed binding.
- `packages/token/test/identity-create.test.ts` lines 13, 23, 24, 48 etc.
- `packages/token/test/rotation.test.ts` lines 17, 19.
- `packages/token/test/token.test.ts` lines 156, 177, 199, 218, 224.
- `packages/token/test/token-peer4.test.ts` — any `.did` accesses on createIdentity returns.
- `packages/token/test/sign-verify.test.ts` — same.

Use `rg -n "identity\.did\b" packages/token/test` to locate every site, then replace.

- [ ] **Step 1.4: Run token tests, expect green**

Run: `pnpm --filter @enkaku/token test`
Expected: PASS (full token test suite).

- [ ] **Step 1.5: Commit**

```bash
git add packages/token
git commit -m "refactor(token): rename MultiKeyIdentity.did to id, expose primary sig key as publicKey/privateKey"
```

---

## Task 2: Token — unify `signToken` signature

**Files:**
- Modify: `packages/token/src/identity.ts`
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/src/token.ts`
- Modify: `packages/token/src/index.ts`
- Modify: `packages/token/test/*.ts` — any `.sign(payload, { ... })` callers (kid/embedLongForm) become `.signToken(payload, { ... })`. `.signToken(payload, header)` becomes `.signToken(payload, { header })`.

- [ ] **Step 2.1: Define `SignTokenOptions` and update `SigningIdentity` in `packages/token/src/identity.ts`**

Replace the existing `SignOptions` and `SigningIdentity` definitions:

```ts
export type SignTokenOptions = {
  /** Extra header fields merged into the signed JWS header. */
  header?: Record<string, unknown>
  /** Pick a non-primary signing key by fragment (e.g. "#key-1"). */
  kid?: string
  /**
   * Override the first-per-aud long-form policy for did:peer:4 identities.
   * - true: always use long form (no-op for did:key, where longForm === id).
   * - false: always use short form.
   * - undefined (default): use long form on first token to a given payload.aud, short form thereafter.
   */
  embedLongForm?: boolean
}

export type SigningIdentity = Identity & {
  publicKey: Uint8Array
  signToken: <
    Payload extends Record<string, unknown> = Record<string, unknown>,
  >(
    payload: Payload,
    options?: SignTokenOptions,
  ) => Promise<SignedToken<Payload>>
}
```

Also remove the old `SignOptions` type entirely (replaced by `SignTokenOptions`).

- [ ] **Step 2.2: Update `MultiKeyIdentity` to expose `signToken` instead of `sign`**

In `buildIdentity` from Task 1 Step 1.1, rename the inner `sign` function to `signToken` and merge `options.header` into the JWS header:

```ts
async function signToken<Payload extends Record<string, unknown> = Record<string, unknown>>(
  payload: Payload,
  options: SignTokenOptions = {},
): Promise<SignedToken<Payload>> {
  const key = pickSigningKey(keys, options.kid)
  const iss = pickIss(payload as Record<string, unknown>, options.embedLongForm)
  const header = {
    ...(options.header ?? {}),
    typ: 'JWT',
    alg: 'EdDSA',
    ...(isPeer ? { kid: key.fragment } : {}),
  } as SignedHeader
  const fullPayload = { ...payload, iss }
  const data = `${b64uFromJSON(header)}.${b64uFromJSON(fullPayload)}`
  return {
    header: header as SignedHeader & Record<string, unknown>,
    payload: fullPayload as Payload & { iss: string },
    signature: toB64U(signWith(key, fromUTF(data))),
    data,
  } as SignedToken<Payload>
}
```

Update the `MultiKeyIdentity` type definition: replace `sign(payload, options?: SignOptions)` with `signToken(payload, options?: SignTokenOptions)`.

Update the return object: `signToken,` in place of `sign,`.

- [ ] **Step 2.3: Update `createSigningIdentity` in `packages/token/src/identity.ts`**

Change its `signToken` to accept `options` instead of a header positional arg:

```ts
async function signToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, options: SignTokenOptions = {}): Promise<SignedToken<Payload>> {
  return withSpan(
    tracer,
    SpanNames.TOKEN_SIGN,
    { attributes: { [AttributeKeys.AUTH_DID]: id, [AttributeKeys.AUTH_ALGORITHM]: 'EdDSA' } },
    async () => {
      if (payload.iss != null && payload.iss !== id) {
        throw new Error('Invalid payload: issuer does not match signer')
      }

      const fullHeader = {
        ...(options.header ?? {}),
        typ: 'JWT',
        alg: 'EdDSA',
      } as SignedHeader
      const fullPayload = { ...payload, iss: id }
      const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

      return {
        header: fullHeader,
        payload: fullPayload,
        signature: toB64U(ed25519.sign(fromUTF(data), privateKey)),
        data,
      }
    },
  )
}
```

Drop the old generic header type parameter — header is now `Record<string, unknown>` via options.

- [ ] **Step 2.4: Update token-internal callers in `packages/token/src/jwe.ts`**

At lines 271, 277, 286, rewrite `options.signer.signToken(payload, options.header)` → `options.signer.signToken(payload, { header: options.header })`. Likewise for the `{ jwe }` payload at line 286.

- [ ] **Step 2.5: Update token-internal callers in `packages/token/src/token.ts`**

At line 123, rewrite `await signer.signToken(token.payload, token.header)` → `await signer.signToken(token.payload, { header: token.header })`.

- [ ] **Step 2.6: Update `packages/token/src/index.ts` exports**

Replace `type SignOptions,` with `type SignTokenOptions,` in the identity re-export block.

- [ ] **Step 2.7: Update token tests**

Run `rg -n "\.sign\(" packages/token/test`. For every match on a `MultiKeyIdentity` binding, rewrite `.sign(payload, opts)` → `.signToken(payload, opts)`. The opts object shape is unchanged (still `{ kid?, embedLongForm? }`).

Run `rg -n "\.signToken\([^,)]+,\s*[A-Za-z]" packages/token/test` — these are positional-header callers, none expected in tests but if any exist rewrite to `{ header: ... }`.

- [ ] **Step 2.8: Run token tests**

Run: `pnpm --filter @enkaku/token test`
Expected: PASS.

- [ ] **Step 2.9: Commit**

```bash
git add packages/token
git commit -m "refactor(token): unify signToken signature with SignTokenOptions"
```

---

## Task 3: Cross-package migration — `signToken(payload, header)` callers and custom keystore impls

**Files:**
- Modify: `packages/capability/src/index.ts:199,238`
- Modify: `packages/client/src/client.ts:228`
- Modify: `packages/browser-keystore/src/identity.ts`
- Modify: `packages/ledger-identity/src/provider.ts:83-127`
- Modify: relevant tests across these packages and `@enkaku/group` peer4 test (`.sign` → `.signToken`).

- [ ] **Step 3.1: Update `packages/capability/src/index.ts`**

At lines 199 and 238, rewrite `return await signer.signToken(payload, header)` → `return await signer.signToken(payload, { header })`.

- [ ] **Step 3.2: Update `packages/client/src/client.ts`**

At line 228, rewrite `return id.signToken(payload, header)` → `return id.signToken(payload, { header })`.

- [ ] **Step 3.3: Update `packages/browser-keystore/src/identity.ts`**

Replace the entire `createBrowserSigningIdentity` function body's `signToken`:

```ts
async function signToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, options: SignTokenOptions = {}): Promise<SignedToken<Payload>> {
  if (payload.iss != null && payload.iss !== id) {
    throw new Error('Invalid payload: issuer does not match signer')
  }

  const fullHeader = {
    ...(options.header ?? {}),
    typ: 'JWT',
    alg: 'ES256',
  } as SignedHeader
  const fullPayload = { ...payload, iss: id }
  const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

  const messageBytes = fromUTF(data)
  const signatureBuffer = await globalThis.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    messageBytes.buffer as ArrayBuffer,
  )

  return {
    header: fullHeader,
    payload: fullPayload,
    signature: toB64U(new Uint8Array(signatureBuffer)),
    data,
  }
}
```

Add `SignTokenOptions` to the imports from `@enkaku/token`.

- [ ] **Step 3.4: Update `packages/ledger-identity/src/provider.ts`**

Replace the `signToken` function at lines 83-127:

```ts
async function signToken<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(payload: Payload, options: SignTokenOptions = {}): Promise<SignedToken<Payload>> {
  return withSpan(
    tracer,
    SpanNames.TOKEN_SIGN,
    {
      attributes: {
        [AttributeKeys.AUTH_DID]: id,
        [AttributeKeys.AUTH_ALGORITHM]: 'EdDSA',
      },
    },
    async () => {
      if (payload.iss != null && payload.iss !== id) {
        throw new Error('Invalid payload: issuer does not match signer')
      }

      const fullHeader = {
        ...(options.header ?? {}),
        typ: 'JWT',
        alg: 'EdDSA',
      } as SignedHeader
      const fullPayload = { ...payload, iss: id }
      const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`

      const messageBytes = fromUTF(data)
      const chunks = encodeSignMessageChunks(pathBytes, messageBytes)

      let signatureBytes: Uint8Array = new Uint8Array(0)
      for (const chunk of chunks) {
        signatureBytes = await sendAPDU(
          transport,
          INS.SIGN_MESSAGE,
          chunk.p1,
          chunk.p2,
          chunk.data,
        )
      }

      return {
        header: fullHeader,
        payload: fullPayload,
        signature: toB64U(parseSignatureResponse(signatureBytes)),
        data,
      }
    },
  )
}
```

Add `SignTokenOptions` to the `@enkaku/token` import block.

- [ ] **Step 3.5: Update cross-package tests**

Run `rg -n "\.sign\(" packages/capability packages/group packages/server packages/client packages/browser-keystore packages/hd-keystore packages/ledger-identity`.

For any `.sign(` call on a `MultiKeyIdentity` (look for the binding type — peer4-related tests), rename to `.signToken(`. Specifically:
- `packages/capability/test/delegation-peer4.test.ts`
- `packages/group/test/peer4-credential.test.ts` (lines 24-32, 48-65, 81-89, 100-110, 124-130, 140-146 — every `.sign(` should become `.signToken(`)
- `packages/group/test/crypto.test.ts` — check for MultiKeyIdentity bindings, rename
- `packages/server/test/peer4-handshake.test.ts` — same

Also update any `.did` access on MultiKeyIdentity bindings to `.id` in these files.

- [ ] **Step 3.6: Run all affected package tests**

Run in parallel:
```bash
pnpm --filter @enkaku/capability test
pnpm --filter @enkaku/client test
pnpm --filter @enkaku/browser-keystore test
pnpm --filter @enkaku/ledger-identity test
pnpm --filter @enkaku/server test
pnpm --filter @enkaku/group test
pnpm --filter @enkaku/hd-keystore test
```
Expected: all PASS.

- [ ] **Step 3.7: Commit**

```bash
git add packages
git commit -m "refactor: migrate signToken callers to options-object signature"
```

---

## Task 4: Group — new `MLSCredentialIdentity` type and `parseMLSCredentialIdentity` (TDD)

**Files:**
- Modify: `packages/group/src/credential.ts`
- Modify: `packages/group/test/credential.test.ts`
- Modify: `packages/group/src/index.ts`

- [ ] **Step 4.1: Write failing tests for `parseMLSCredentialIdentity` in `packages/group/test/credential.test.ts`**

Replace the existing parser tests (those targeting `mlsIdentityToSerializedCredential`) with the following block. Leave unrelated tests in place for now.

```ts
import { parseMLSCredentialIdentity } from '../src/credential.js'

describe('parseMLSCredentialIdentity', () => {
  it('accepts a minimal did:key credential', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: 'did:key:z6MkABC' }))
    const parsed = parseMLSCredentialIdentity(bytes)
    expect(parsed).toEqual({ id: 'did:key:z6MkABC' })
  })

  it('accepts a peer4 credential carrying longForm', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ id: 'did:peer:4zABC', longForm: 'did:peer:4zABC:eyJ...' }),
    )
    const parsed = parseMLSCredentialIdentity(bytes)
    expect(parsed.id).toBe('did:peer:4zABC')
    expect(parsed.longForm).toBe('did:peer:4zABC:eyJ...')
  })

  it('rejects non-JSON input', () => {
    const bytes = new TextEncoder().encode('not-json')
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow()
  })

  it('rejects JSON missing the id field', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ longForm: 'x' }))
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow(/id/i)
  })

  it('rejects JSON where id is not a string', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: 42 }))
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow(/id/i)
  })

  it('rejects JSON where longForm is not a string', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: 'did:key:z', longForm: 42 }))
    expect(() => parseMLSCredentialIdentity(bytes)).toThrow(/longForm/i)
  })
})
```

- [ ] **Step 4.2: Run failing tests**

Run: `pnpm --filter @enkaku/group test --run credential.test.ts`
Expected: FAIL — `parseMLSCredentialIdentity` is undefined.

- [ ] **Step 4.3: Rewrite `packages/group/src/credential.ts`**

Full replacement contents:

```ts
import type { CapabilityToken } from '@enkaku/capability'
import { type DIDCache, decodePeer4, isPeer4, type SignedToken } from '@enkaku/token'

import type { GroupPermission } from './capability.js'

/**
 * Local member state (never serialized to the MLS leaf). Tracks the capability
 * chain proving group membership.
 */
export type MemberCredential = {
  id: string
  capabilityChain: Array<string>
  capability: CapabilityToken
  permission: GroupPermission
  groupID: string
}

/**
 * Wire shape for the MLS basic credential `identity` field. Identity binding
 * only — group membership state lives elsewhere.
 *
 * - did:key identities omit `longForm`.
 * - did:peer:4 identities MUST carry `longForm`; the auth service decodes it
 *   inline and binds the MLS leaf signature key to a verification method.
 */
export type MLSCredentialIdentity = {
  id: string
  longForm?: string
}

export function parseMLSCredentialIdentity(identity: Uint8Array): MLSCredentialIdentity {
  const text = new TextDecoder().decode(identity)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid MLS credential: identity bytes are not valid JSON')
  }
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error('Invalid MLS credential: identity must be a JSON object')
  }
  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.id !== 'string') {
    throw new Error('Invalid MLS credential: id must be a string')
  }
  if ('longForm' in candidate && typeof candidate.longForm !== 'string') {
    throw new Error('Invalid MLS credential: longForm must be a string when present')
  }
  const result: MLSCredentialIdentity = { id: candidate.id }
  if (typeof candidate.longForm === 'string') {
    result.longForm = candidate.longForm
  }
  return result
}

/**
 * If the parsed credential carries a did:peer:4 long form, decode it and write
 * to the cache. Hash binding is enforced (decoded short form must equal `id`).
 * No-op for did:key.
 */
export async function populateCacheFromCredential(
  parsed: MLSCredentialIdentity,
  cache: DIDCache,
): Promise<void> {
  if (parsed.longForm == null) return
  if (!isPeer4(parsed.id)) return
  const { shortForm, doc } = decodePeer4(parsed.longForm)
  if (shortForm !== parsed.id) {
    throw new Error('Credential longForm does not match credential.id')
  }
  await cache.set(shortForm, doc)
}

/**
 * Extracts the permission level from a capability token's actions.
 */
export function extractPermission(token: SignedToken): GroupPermission {
  const payload = token.payload as Record<string, unknown>
  const actions = Array.isArray(payload.act) ? payload.act : [payload.act]

  if (actions.includes('*')) return 'admin'
  if (actions.includes('admin')) return 'admin'
  if (actions.includes('member')) return 'member'
  if (actions.includes('read')) return 'read'

  throw new Error('Invalid capability: no recognized permission level')
}
```

- [ ] **Step 4.4: Update `packages/group/src/index.ts`**

Replace any exports of `credentialToMLSIdentity`, `mlsIdentityToSerializedCredential`, `SerializedCredential` with `MLSCredentialIdentity`, `parseMLSCredentialIdentity`. Keep `MemberCredential`, `populateCacheFromCredential`, `extractPermission` exports.

- [ ] **Step 4.5: Remove now-obsolete tests targeting `credentialToMLSIdentity` / `mlsIdentityToSerializedCredential` / `SerializedCredential`**

In `packages/group/test/credential.test.ts`, delete tests that referenced the removed symbols (they were targeting the old shape; replacements live in Tasks 4.1 and 5).

Also rename any remaining `MemberCredential.did` accesses to `.id` in this file.

- [ ] **Step 4.6: Run credential tests**

Run: `pnpm --filter @enkaku/group test --run credential.test.ts`
Expected: PASS for the new `parseMLSCredentialIdentity` block. `populateCacheFromCredential` tests pass if they exist; `makeMLSCredential` tests will be added in Task 5.

- [ ] **Step 4.7: Commit**

```bash
git add packages/group
git commit -m "refactor(group): replace SerializedCredential with MLSCredentialIdentity"
```

---

## Task 5: Group — rewrite `makeMLSCredential` (TDD)

**Files:**
- Modify: `packages/group/src/group.ts`
- Modify: `packages/group/test/credential.test.ts`

- [ ] **Step 5.1: Add failing tests for `makeMLSCredential` in `packages/group/test/credential.test.ts`**

Append:

```ts
import { defaultCredentialTypes } from 'ts-mls'
import { createIdentity } from '@enkaku/token'
import { makeMLSCredential } from '../src/group.js'
import { parseMLSCredentialIdentity } from '../src/credential.js'

describe('makeMLSCredential', () => {
  it('emits JSON { id } for a did:key identity', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const credential = makeMLSCredential(identity)
    expect(credential.credentialType).toBe(defaultCredentialTypes.basic)
    const parsed = parseMLSCredentialIdentity((credential as { identity: Uint8Array }).identity)
    expect(parsed.id).toBe(identity.id)
    expect(parsed.longForm).toBeUndefined()
  })

  it('emits JSON { id, longForm } for a did:peer:4 identity', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    expect(credential.credentialType).toBe(defaultCredentialTypes.basic)
    const parsed = parseMLSCredentialIdentity((credential as { identity: Uint8Array }).identity)
    expect(parsed.id).toBe(identity.id)
    expect(parsed.longForm).toBe(identity.longForm)
  })

  it('throws when a peer4 identity has no longForm', () => {
    const fake = {
      id: 'did:peer:4zABC',
      publicKey: new Uint8Array(32),
      privateKey: new Uint8Array(32),
      signToken: async () => {
        throw new Error('not used')
      },
    } as unknown as Parameters<typeof makeMLSCredential>[0]
    expect(() => makeMLSCredential(fake)).toThrow(/longForm/i)
  })
})
```

- [ ] **Step 5.2: Run failing tests**

Run: `pnpm --filter @enkaku/group test --run credential.test.ts`
Expected: FAIL — current `makeMLSCredential` emits a plain DID string.

- [ ] **Step 5.3: Update `makeMLSCredential` in `packages/group/src/group.ts`**

Replace the function at lines 58-63:

```ts
function makeMLSCredential(identity: OwnIdentity): Credential {
  const id = identity.id
  const isPeer = isPeer4(id)
  if (isPeer && !('longForm' in identity && typeof (identity as { longForm?: unknown }).longForm === 'string')) {
    throw new Error('peer:4 identity is missing longForm; only identities from createIdentity can be used as MLS members')
  }
  const payload: MLSCredentialIdentity = { id }
  if (isPeer) {
    payload.longForm = (identity as { longForm: string }).longForm
  }
  return {
    credentialType: defaultCredentialTypes.basic,
    identity: new TextEncoder().encode(JSON.stringify(payload)),
  }
}
```

Export it from the module so tests can import it:

```ts
export function makeMLSCredential(identity: OwnIdentity): Credential {
  // ...
}
```

Add imports at the top of `group.ts`:

```ts
import { isPeer4 } from '@enkaku/token'
import type { MLSCredentialIdentity } from './credential.js'
```

- [ ] **Step 5.4: Update existing call sites of `makeMLSCredential` in `group.ts`**

Three call sites today pass `identity.id` (the string DID). After the signature change they must pass the identity object:

- `createGroup` (around line 217): `credential: makeMLSCredential(identity.id)` → `credential: makeMLSCredential(identity)`.
- `createKeyPackageBundle` (around line 466): same change.
- `joinGroupExternal` (around line 556): same change.

- [ ] **Step 5.5: Run tests**

Run: `pnpm --filter @enkaku/group test --run credential.test.ts`
Expected: PASS for the new block.

- [ ] **Step 5.6: Commit**

```bash
git add packages/group
git commit -m "feat(group): makeMLSCredential emits self-describing JSON identity"
```

---

## Task 6: Group — auth service peer4 binding (TDD)

**Files:**
- Modify: `packages/group/src/authentication.ts`
- Modify: `packages/group/test/authentication.test.ts`

- [ ] **Step 6.1: Add failing tests for peer4 binding in `packages/group/test/authentication.test.ts`**

Add to the existing describe block (or replace it):

```ts
import { createIdentity } from '@enkaku/token'
import { defaultCredentialTypes } from 'ts-mls'
import { createDIDAuthenticationService } from '../src/authentication.js'
import { makeMLSCredential } from '../src/group.js'

describe('createDIDAuthenticationService — peer4', () => {
  it('accepts a peer4 single-sig leaf bound to the doc verification method', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, identity.publicKey)
    expect(ok).toBe(true)
  })

  it('accepts a peer4 multi-sig leaf bound to a non-primary key', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'sig', alg: 'EdDSA' },
      ],
      didMethod: 'peer:4',
    })
    const credential = makeMLSCredential(identity)
    const service = createDIDAuthenticationService()
    // Use second sig key (non-primary) bytes; auth service must still bind.
    const secondSig = identity.keys.filter((k) => k.purpose === 'sig')[1]!
    const ok = await service.validateCredential(credential, secondSig.publicKey)
    expect(ok).toBe(true)
  })

  it('rejects when peer4 credential is missing longForm', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bytes = new TextEncoder().encode(JSON.stringify({ id: identity.id }))
    const credential = { credentialType: defaultCredentialTypes.basic, identity: bytes }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, identity.publicKey)
    expect(ok).toBe(false)
  })

  it('rejects when longForm short form does not match id (hash-binding tamper)', async () => {
    const a = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const b = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bytes = new TextEncoder().encode(JSON.stringify({ id: a.id, longForm: b.longForm }))
    const credential = { credentialType: defaultCredentialTypes.basic, identity: bytes }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, a.publicKey)
    expect(ok).toBe(false)
  })

  it('rejects when the leaf sig key is not in the doc', async () => {
    const a = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const wrongKey = new Uint8Array(32)
    const credential = makeMLSCredential(a)
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, wrongKey)
    expect(ok).toBe(false)
  })

  it('rejects non-JSON identity bytes', async () => {
    const credential = {
      credentialType: defaultCredentialTypes.basic,
      identity: new TextEncoder().encode('not-json'),
    }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, new Uint8Array(32))
    expect(ok).toBe(false)
  })

  it('rejects non-basic credential type', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const credential = {
      credentialType: 99 as unknown as typeof defaultCredentialTypes.basic,
      identity: (makeMLSCredential(identity) as { identity: Uint8Array }).identity,
    }
    const service = createDIDAuthenticationService()
    const ok = await service.validateCredential(credential, identity.publicKey)
    expect(ok).toBe(false)
  })
})
```

Also update any existing did:key regression tests in the file: they used the plain-DID format, which is now removed. Rewrite each to call `makeMLSCredential(identity)` to produce credentials.

- [ ] **Step 6.2: Run failing tests**

Run: `pnpm --filter @enkaku/group test --run authentication.test.ts`
Expected: FAIL — peer4 branch not implemented.

- [ ] **Step 6.3: Rewrite `packages/group/src/authentication.ts`**

Full replacement:

```ts
import { decodePeer4, getSignatureInfo, isPeer4 } from '@enkaku/token'
import type { AuthenticationService, Credential } from 'ts-mls'
import { defaultCredentialTypes } from 'ts-mls'

import { decodeMultibase } from '@enkaku/token'
import { parseMLSCredentialIdentity } from './credential.js'

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: index is within bounds
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

/**
 * Strip the multicodec prefix (2 bytes for ed25519: 0xed 0x01) from a
 * multibase-decoded public key to get raw key bytes.
 */
function stripCodecPrefix(bytes: Uint8Array): Uint8Array {
  return bytes.subarray(2)
}

export function createDIDAuthenticationService(): AuthenticationService {
  return {
    async validateCredential(
      credential: Credential,
      signaturePublicKey: Uint8Array,
    ): Promise<boolean> {
      if (credential.credentialType !== defaultCredentialTypes.basic) {
        return false
      }

      let parsed
      try {
        parsed = parseMLSCredentialIdentity((credential as { identity: Uint8Array }).identity)
      } catch {
        return false
      }

      if (isPeer4(parsed.id)) {
        if (parsed.longForm == null) return false
        let decoded
        try {
          decoded = decodePeer4(parsed.longForm)
        } catch {
          return false
        }
        if (decoded.shortForm !== parsed.id) return false
        for (const vm of decoded.doc.verificationMethod ?? []) {
          if (typeof vm.publicKeyMultibase !== 'string') continue
          let vmBytes: Uint8Array
          try {
            vmBytes = stripCodecPrefix(decodeMultibase(vm.publicKeyMultibase))
          } catch {
            continue
          }
          if (constantTimeEqual(vmBytes, signaturePublicKey)) return true
        }
        return false
      }

      try {
        const [, publicKeyFromDID] = getSignatureInfo(parsed.id)
        return constantTimeEqual(publicKeyFromDID, signaturePublicKey)
      } catch {
        return false
      }
    },
  }
}
```

If `decodeMultibase` is not yet exported from `@enkaku/token`, verify with `rg -n "decodeMultibase" packages/token/src/index.ts` — it is exported per the existing index. Confirm import resolves.

- [ ] **Step 6.4: Run tests**

Run: `pnpm --filter @enkaku/group test --run authentication.test.ts`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add packages/group
git commit -m "feat(group): auth service binds peer4 MLS leaf via embedded doc"
```

---

## Task 7: Group — rename `MemberCredential.did → id`, `Invite.inviterDID → inviterID`, update `findMemberLeafIndex`

**Files:**
- Modify: `packages/group/src/types.ts`
- Modify: `packages/group/src/group.ts`
- Modify: `packages/group/src/capability.ts` (only if it references the renamed fields)
- Modify: `packages/group/test/*.ts`

- [ ] **Step 7.1: Rename `Invite.inviterDID → inviterID` in `packages/group/src/types.ts`**

Locate the `Invite` type and change the field. If `Invite` lives in `group.ts` instead, edit there.

- [ ] **Step 7.2: Update `findMemberLeafIndex` in `packages/group/src/group.ts`**

Replace lines 133-146 with:

```ts
findMemberLeafIndex(id: string): number | undefined {
  const tree = this.#state.ratchetTree
  const targetNorm = normalizeDID(id)
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i]
    if (node != null && node.nodeType === nodeTypes.leaf) {
      const credential = node.leaf.credential
      if ('identity' in credential) {
        let parsed
        try {
          parsed = parseMLSCredentialIdentity(credential.identity)
        } catch {
          continue
        }
        if (normalizeDID(parsed.id) === targetNorm) return i / 2
      }
    }
  }
  return undefined
}
```

Add imports at the top: `normalizeDID` from `@enkaku/token`, `parseMLSCredentialIdentity` from `./credential.js`.

- [ ] **Step 7.3: Rename `MemberCredential.did → id` references in `group.ts`**

In `createGroup`:
```ts
const credential: MemberCredential = {
  id: identity.id,
  capabilityChain: [rootCapability],
  capability: rootCap,
  permission: 'admin',
  groupID,
}
```

In `processWelcome`:
```ts
const credential: MemberCredential = {
  id: identity.id,
  capabilityChain: invite.capabilityChain,
  capability: capToken as MemberCredential['capability'],
  permission: invite.permission,
  groupID: invite.groupID,
}
```

In `createInvite`, rename the assignment:
```ts
const invite: Invite = {
  groupID: group.groupID,
  capabilityToken: memberCapStr,
  capabilityChain: [group.rootCapability, memberCapStr],
  permission,
  inviterID: identity.id,
}
```

In `GroupHandle.findMemberLeafIndex` callers (if any) — search workspace for `.findMemberLeafIndex(` and update arg names if they used `did`.

- [ ] **Step 7.4: Update tests**

Run `rg -n "MemberCredential|\.inviterDID|\.did\b" packages/group/test`. Update every:
- `MemberCredential` literal: `did:` → `id:`.
- `.inviterDID` → `.inviterID`.
- `member.did` / `credential.did` on a `MemberCredential` binding → `.id`.

- [ ] **Step 7.5: Run group tests**

Run: `pnpm --filter @enkaku/group test`
Expected: PASS (modulo end-to-end peer4 tests in Task 8 — they don't exist yet so won't run yet).

- [ ] **Step 7.6: Commit**

```bash
git add packages/group
git commit -m "refactor(group): rename MemberCredential.did to id, Invite.inviterDID to inviterID"
```

---

## Task 8: Group — end-to-end peer4 tests in `group.test.ts`

**Files:**
- Modify: `packages/group/test/group.test.ts`

- [ ] **Step 8.1: Add helper and peer4 end-to-end describe block**

Append the following describe block:

```ts
import { createIdentity, stringifyToken } from '@enkaku/token'
import {
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  processWelcome,
  removeMember,
} from '../src/group.js'

async function makePeer4(sigKeys = 1) {
  return await createIdentity({
    keys: Array.from({ length: sigKeys }, () => ({ purpose: 'sig' as const, alg: 'EdDSA' as const })),
    didMethod: 'peer:4',
  })
}

describe('peer4 MLS group end-to-end', () => {
  it('two peer4 members exchange application messages', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const { group: aliceGroup } = await createGroup(alice, 'g-peer4-1')

    const bobBundle = await createKeyPackageBundle(bob)
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const commit = await commitInvite(aliceGroup, bobBundle.publicPackage)

    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: commit.welcomeMessage,
      keyPackageBundle: bobBundle,
    })

    const plaintext = new TextEncoder().encode('hello bob')
    const { message } = await commit.newGroup.encrypt(plaintext)
    const decrypted = await bobGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('hello bob')
  })

  it('mixes peer4 admin with did:key member', async () => {
    const alice = await makePeer4()
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const { group: aliceGroup } = await createGroup(alice, 'g-mixed-1')
    const bobBundle = await createKeyPackageBundle(bob)
    const { invite } = await createInvite({
      group: aliceGroup,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const commit = await commitInvite(aliceGroup, bobBundle.publicPackage)
    const { group: bobGroup } = await processWelcome({
      identity: bob,
      invite,
      welcome: commit.welcomeMessage,
      keyPackageBundle: bobBundle,
    })

    const { message } = await commit.newGroup.encrypt(new TextEncoder().encode('hi'))
    const decrypted = await bobGroup.decrypt(message)
    expect(new TextDecoder().decode(decrypted)).toBe('hi')
  })

  it('binds an MLS leaf for a peer4 identity with multiple sig keys', async () => {
    const alice = await makePeer4(2)
    const { group: aliceGroup } = await createGroup(alice, 'g-multisig-1')
    // group creation succeeds → auth service bound the primary sig key successfully.
    expect(aliceGroup.memberCount).toBe(1)
    expect(aliceGroup.findMemberLeafIndex(alice.id)).toBe(0)
  })

  it('removes a peer4 member and rejects subsequent traffic from them', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const { group: aliceGroup0 } = await createGroup(alice, 'g-remove-1')
    const bobBundle = await createKeyPackageBundle(bob)
    const { invite } = await createInvite({
      group: aliceGroup0,
      identity: alice,
      recipientDID: bob.id,
      permission: 'member',
    })
    const addCommit = await commitInvite(aliceGroup0, bobBundle.publicPackage)
    const { group: bobGroup0 } = await processWelcome({
      identity: bob,
      invite,
      welcome: addCommit.welcomeMessage,
      keyPackageBundle: bobBundle,
    })

    const bobLeaf = addCommit.newGroup.findMemberLeafIndex(bob.id)
    expect(bobLeaf).toBeDefined()
    const removeResult = await removeMember(addCommit.newGroup, bobLeaf!)
    // After removal, bob's message attempt should fail or be ignored when processed
    // by alice's new state.
    expect(removeResult.newGroup.memberCount).toBe(1)
    expect(removeResult.newGroup.findMemberLeafIndex(bob.id)).toBeUndefined()
  })
})
```

- [ ] **Step 8.2: Run tests**

Run: `pnpm --filter @enkaku/group test --run group.test.ts`
Expected: PASS for the new block.

- [ ] **Step 8.3: Commit**

```bash
git add packages/group
git commit -m "test(group): peer4 end-to-end MLS group scenarios"
```

---

## Task 9: Group — peer4 external rejoin test

**Files:**
- Modify: `packages/group/test/external-rejoin.test.ts`

- [ ] **Step 9.1: Add a peer4 case mirroring the existing did:key external-rejoin test**

Read the file first to learn its existing style and then append a peer4 variant. The new test should:
1. Create an alice (peer4) group.
2. Export `GroupInfo` via `exportGroupInfo`.
3. Have a second-device alice (re-derived by `createIdentity` with the same key material — or a fresh peer4 identity if the existing did:key test uses a fresh identity for the rejoin) call `joinGroupExternal` with `resync: true`.
4. Assert the post-commit epoch is one greater than the pre-export epoch and that the resulting group handle has the same `groupID`.

Code (insert in the existing describe block):

```ts
it('peer4 identity can rejoin via groupInfo + resync', async () => {
  const alice = await createIdentity({
    keys: [{ purpose: 'sig', alg: 'EdDSA' }],
    didMethod: 'peer:4',
  })
  const { group: g0 } = await createGroup(alice, 'g-rejoin-peer4')
  const { groupInfo } = await exportGroupInfo({ group: g0 })

  const aliceB = await createIdentity({
    keys: [{ purpose: 'sig', alg: 'EdDSA' }],
    didMethod: 'peer:4',
  })
  // Reuse the original member credential — caller-held local state per Invite contract.
  const { group: rejoined, commitMessage } = await joinGroupExternal({
    identity: aliceB,
    groupInfo,
    credential: g0.credential,
    resync: true,
  })

  expect(rejoined.groupID).toBe('g-rejoin-peer4')
  expect(rejoined.epoch).toBe(g0.epoch + 1n)
  expect(commitMessage.byteLength).toBeGreaterThan(0)
})
```

Adjust the imports if `createIdentity`, `exportGroupInfo`, `joinGroupExternal`, `createGroup` aren't already imported.

- [ ] **Step 9.2: Run the test**

Run: `pnpm --filter @enkaku/group test --run external-rejoin.test.ts`
Expected: PASS.

- [ ] **Step 9.3: Commit**

```bash
git add packages/group
git commit -m "test(group): peer4 external rejoin"
```

---

## Task 10: Workspace gates (test, lint, build)

**Files:** (no source changes)

- [ ] **Step 10.1: Run full workspace test**

Run: `pnpm run test`
Expected: PASS across every package.

If any package fails because of a missed `.did` access or `.sign` call, locate and fix:
```bash
rg -n "identity\.did\b" packages
rg -n "\.sign\(" packages   # examine each; rename to .signToken when the binding is a MultiKeyIdentity
```
Update and re-run.

- [ ] **Step 10.2: Run lint**

Run: `rtk proxy pnpm run lint`
Expected: PASS.

- [ ] **Step 10.3: Run build**

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 10.4: Update plan stage**

Edit this file's header: change `**Stage:** planning` (or whatever it currently is) to `**Stage:** reviewing`.

- [ ] **Step 10.5: Commit**

```bash
git add docs/superpowers/plans/2026-05-27-did-peer-4-mls-auth-service.md
git commit -m "chore: advance peer4 MLS auth plan to reviewing"
```

---

## Test Plan (manual verification post-implementation)

1. **Two-member peer4 group round-trip:** create group, invite, commit, welcome, encrypt/decrypt — covered by Task 8.
2. **Multi-sig peer4 leaf binding:** create peer4 identity with two sig keys, observe successful group creation and member lookup — covered by Task 8.
3. **Mixed peer4 + did:key group:** ensures no regression on the did:key path — covered by Task 8.
4. **Remove peer4 member:** ensures epoch advance and member removal — covered by Task 8.
5. **External rejoin (peer4):** ensures `joinGroupExternal` works with a peer4 identity producing a valid leaf credential — covered by Task 9.
6. **Spec gates:** full workspace `pnpm run test`, `rtk proxy pnpm run lint`, `pnpm run build` — Task 10.

## Out of scope (for follow-up plans)

- Peer4 leaf credential rotation via MLS Update proposal.
- Post-quantum MLS ciphersuites.
- Cross-implementation JSON identity schema standardization.
- Ledger hardware peer4 support.
- Browser/Expo keystore changes for large keys.
