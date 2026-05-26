# did:peer:4 transport integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** executing — Gate 2 complete

**Goal:** Wire `did:peer:4` long/short-form identifiers through the token, capability, server, and group layers using token-layer self-bootstrap (long-form `iss` on first contact) — no transport-layer changes.

**Architecture:** First token from a peer4 identity to a given audience embeds the long-form DID (with full DID doc) in `iss`. Receivers decode inline, hash-verify, and cache. Subsequent tokens use short form, resolved via cache. A `DIDResolver` provides an escape hatch. Capability delegation threads the same cache through recursive `verifyToken` calls so the cache populates transitively along the chain. MLS group credentials carry the long form in the JSON identity payload. A `normalizeDID` helper folds long/short to short for all string-equality comparisons of DIDs.

**Tech Stack:** TypeScript, pnpm workspace, vitest, biome. Packages: `@enkaku/token`, `@enkaku/capability`, `@enkaku/server`, `@enkaku/group`. Spec: `docs/superpowers/specs/2026-05-26-did-peer-4-transport-integration-design.md`. Branch: `feat/peer4-propagation`.

---

## Gate execution rules

Each stage is a "gate". After every gate passes locally (`pnpm run build && pnpm run lint && pnpm run test` all green), commit, then advance. If a gate's stop-and-surface condition fires, write a finding doc at `docs/agents/findings/2026-05-26-peer4-<topic>.md` describing inputs / expected / observed / hypothesis, halt the plan, and report to the user.

**Stop-and-surface conditions:**
- **Gate 2** — any cell of the delegation matrix fails (Tasks 2.3a–2.3f).
- **Gate 3 (Task 3.1)** — audit confirms the server does not currently verify the outer message's signature anywhere.

---

## Stage 1 — Token layer (Gate 1)

File structure for this stage:

| File | Action | Responsibility |
|---|---|---|
| `packages/token/src/did.ts` | modify | `normalizeDID` helper; `resolveIssuer` accepts `cache` and returns `peer4Doc` for inline long-form. |
| `packages/token/src/cache.ts` | modify | Bounded LRU `createInMemoryDIDCache({ maxEntries })`. |
| `packages/token/src/token.ts` | modify | `verifyToken({ cache })`; defer `cache.set` until after sig verify. |
| `packages/token/src/identity.ts` | modify | `MultiKeyIdentity.sign` accepts `embedLongForm`; internal `sentTo: Set<string>` first-per-aud policy. |
| `packages/token/src/index.ts` | modify | Export `normalizeDID`, `MaxEntriesOption`. |
| `packages/token/test/normalize-did.test.ts` | create | Unit tests for `normalizeDID`. |
| `packages/token/test/cache.test.ts` | modify | Add LRU eviction tests. |
| `packages/token/test/resolve-issuer.test.ts` | modify | Add long-form inline decode tests. |
| `packages/token/test/token.test.ts` | modify | Add `verifyToken({ cache })` write-after-verify tests. |
| `packages/token/test/identity.test.ts` | modify | Add `sign({ embedLongForm })` and first-per-aud policy tests. |

---

### Task 1.1: `normalizeDID` helper

**Files:**
- Modify: `packages/token/src/did.ts`
- Modify: `packages/token/src/index.ts`
- Create: `packages/token/test/normalize-did.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/token/test/normalize-did.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { normalizeDID } from '../src/did.js'
import { encodePeer4 } from '../src/peer4.js'

const sampleDoc = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [
    { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkSampleKey' },
  ],
  authentication: ['#key-0'],
}

describe('normalizeDID', () => {
  it('folds did:peer:4 long form to short form', () => {
    const { longForm, shortForm } = encodePeer4(sampleDoc)
    expect(normalizeDID(longForm)).toBe(shortForm)
  })

  it('returns did:peer:4 short form unchanged', () => {
    const { shortForm } = encodePeer4(sampleDoc)
    expect(normalizeDID(shortForm)).toBe(shortForm)
  })

  it('passes did:key through unchanged', () => {
    const did = 'did:key:z6MkExampleKey1234567890'
    expect(normalizeDID(did)).toBe(did)
  })

  it('passes other strings through unchanged', () => {
    expect(normalizeDID('not-a-did')).toBe('not-a-did')
    expect(normalizeDID('')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/token test test/normalize-did.test.ts`
Expected: FAIL with `normalizeDID is not exported`.

- [ ] **Step 3: Implement `normalizeDID`**

In `packages/token/src/did.ts`, add after the imports block:

```ts
import { getPeer4ShortForm, isPeer4 } from './peer4.js'

/**
 * Fold a DID to its canonical form for equality comparison.
 * For did:peer:4, returns the short form regardless of whether input is long or short.
 * All other DID methods pass through unchanged.
 */
export function normalizeDID(did: string): string {
  return isPeer4(did) ? getPeer4ShortForm(did) : did
}
```

(The `isPeer4`/`getPeer4ShortForm` import already exists in this file — don't duplicate.)

- [ ] **Step 4: Export from `index.ts`**

In `packages/token/src/index.ts`, find the block exporting from `./did.js` and add `normalizeDID`:

```ts
export {
  CODECS,
  getAlgorithmAndPublicKey,
  getDID,
  getSignatureInfo,
  normalizeDID,
  type ResolveIssuerHeader,
  resolveIssuer,
} from './did.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @enkaku/token test test/normalize-did.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/token/src/did.ts packages/token/src/index.ts packages/token/test/normalize-did.test.ts
git commit -m "feat(token): add normalizeDID helper for peer4 long/short folding"
```

---

### Task 1.2: Bounded LRU cache

**Files:**
- Modify: `packages/token/src/cache.ts`
- Modify: `packages/token/test/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/token/test/cache.test.ts` (inside the existing top-level describe or in a new `describe('createInMemoryDIDCache LRU', ...)`):

```ts
import { ed25519 } from '@noble/curves/ed25519.js'
import { encodeMultibase } from '../src/multibase.js'

function makeDoc(seed: number) {
  const priv = new Uint8Array(32).fill(seed % 256)
  const pub = ed25519.getPublicKey(priv)
  const ed25519Codec = new Uint8Array([0xed, 0x01])
  const tagged = new Uint8Array(ed25519Codec.length + pub.length)
  tagged.set(ed25519Codec, 0)
  tagged.set(pub, ed25519Codec.length)
  return {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod: [
      { id: '#key-0', type: 'Multikey', publicKeyMultibase: encodeMultibase(tagged) },
    ],
    authentication: ['#key-0'],
  }
}

describe('createInMemoryDIDCache LRU', () => {
  it('evicts oldest entry when maxEntries exceeded', async () => {
    const cache = createInMemoryDIDCache({ maxEntries: 2 })
    const a = encodePeer4(makeDoc(1))
    const b = encodePeer4(makeDoc(2))
    const c = encodePeer4(makeDoc(3))
    await cache.set(a.shortForm, a.doc)
    await cache.set(b.shortForm, b.doc)
    await cache.set(c.shortForm, c.doc)
    expect(await cache.get(a.shortForm)).toBeUndefined()
    expect(await cache.get(b.shortForm)).toEqual(b.doc)
    expect(await cache.get(c.shortForm)).toEqual(c.doc)
  })

  it('treats get as a recency hit, protecting from eviction', async () => {
    const cache = createInMemoryDIDCache({ maxEntries: 2 })
    const a = encodePeer4(makeDoc(4))
    const b = encodePeer4(makeDoc(5))
    const c = encodePeer4(makeDoc(6))
    await cache.set(a.shortForm, a.doc)
    await cache.set(b.shortForm, b.doc)
    await cache.get(a.shortForm) // bumps a
    await cache.set(c.shortForm, c.doc)
    expect(await cache.get(a.shortForm)).toEqual(a.doc) // survives
    expect(await cache.get(b.shortForm)).toBeUndefined() // evicted
    expect(await cache.get(c.shortForm)).toEqual(c.doc)
  })

  it('defaults to a generous maxEntries when omitted', async () => {
    const cache = createInMemoryDIDCache()
    // Spot-check that at least 100 entries survive default config.
    const docs = []
    for (let i = 0; i < 100; i++) {
      const d = encodePeer4(makeDoc(i + 10))
      docs.push(d)
      await cache.set(d.shortForm, d.doc)
    }
    expect(await cache.get(docs[0].shortForm)).toEqual(docs[0].doc)
    expect(await cache.get(docs[99].shortForm)).toEqual(docs[99].doc)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/token test test/cache.test.ts -t LRU`
Expected: FAIL — `createInMemoryDIDCache` does not accept options / no eviction.

- [ ] **Step 3: Implement bounded LRU**

Replace the body of `packages/token/src/cache.ts` with:

```ts
import { type DIDDoc, encodePeer4, isPeer4 } from './peer4.js'

export type DIDResolver = (did: string) => DIDDoc | undefined | Promise<DIDDoc | undefined>

export type DIDCache = {
  get(shortForm: string): DIDDoc | undefined | Promise<DIDDoc | undefined>
  set(shortForm: string, doc: DIDDoc): void | Promise<void>
}

export type CreateInMemoryDIDCacheOptions = {
  /** Maximum number of cached entries. Oldest evicted first. Default 10_000. */
  maxEntries?: number
}

const DEFAULT_MAX_ENTRIES = 10_000

/**
 * Build an in-memory DID cache. The returned cache verifies short-form/doc binding on every set
 * and evicts least-recently-used entries when maxEntries is exceeded.
 */
export function createInMemoryDIDCache(options: CreateInMemoryDIDCacheOptions = {}): DIDCache {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  if (maxEntries < 1) {
    throw new Error('DIDCache: maxEntries must be at least 1')
  }
  const docs = new Map<string, DIDDoc>()

  function touch(shortForm: string, doc: DIDDoc): void {
    docs.delete(shortForm)
    docs.set(shortForm, doc)
  }

  return {
    get(shortForm) {
      const doc = docs.get(shortForm)
      if (doc != null) {
        touch(shortForm, doc)
      }
      return doc
    },
    set(shortForm, doc) {
      if (!isPeer4(shortForm)) {
        return Promise.reject(new Error('DIDCache: short form must be a did:peer:4 identifier'))
      }
      const expected = encodePeer4(doc).shortForm
      if (expected !== shortForm) {
        return Promise.reject(new Error('DIDCache: short form/doc hash mismatch'))
      }
      touch(shortForm, doc)
      while (docs.size > maxEntries) {
        const oldest = docs.keys().next().value
        if (oldest == null) break
        docs.delete(oldest)
      }
      return Promise.resolve()
    },
  }
}
```

- [ ] **Step 4: Export the new option type**

In `packages/token/src/index.ts`, find the `./cache.js` export block and update it to:

```ts
export {
  createInMemoryDIDCache,
  type CreateInMemoryDIDCacheOptions,
  type DIDCache,
  type DIDResolver,
} from './cache.js'
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @enkaku/token test test/cache.test.ts`
Expected: PASS, all existing tests + 3 new LRU tests.

- [ ] **Step 6: Commit**

```bash
git add packages/token/src/cache.ts packages/token/src/index.ts packages/token/test/cache.test.ts
git commit -m "feat(token): bound in-memory DID cache with LRU eviction"
```

---

### Task 1.3: `resolveIssuer` long-form inline + internal-helper return shape

**Files:**
- Modify: `packages/token/src/did.ts`
- Modify: `packages/token/test/resolve-issuer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/token/test/resolve-issuer.test.ts` (before the closing `})`):

```ts
  it('decodes a did:peer:4 long-form issuer inline without calling the resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { longForm } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    let resolverCalled = false
    const resolver = () => {
      resolverCalled = true
      return undefined
    }
    const [alg, key] = await resolveIssuer(longForm, { kid: '#key-0' }, resolver)
    expect(resolverCalled).toBe(false)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('decodes long form inline even without a resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { longForm } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const [alg, key] = await resolveIssuer(longForm, { kid: '#key-0' })
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })
```

Also add a separate describe block (still in the same file) for the internal helper that returns the decoded doc:

```ts
import { resolveIssuerWithDoc } from '../src/did.js'

describe('resolveIssuerWithDoc', () => {
  it('returns the decoded doc when iss is a long-form did:peer:4', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { longForm, shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const result = await resolveIssuerWithDoc(longForm, { kid: '#key-0' })
    expect(result.alg).toBe('EdDSA')
    expect(result.publicKey).toEqual(pub)
    expect(result.peer4Doc).toEqual({ shortForm, doc })
  })

  it('returns no peer4Doc for short-form resolved via resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const { shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    const resolver = (did: string) => (did === shortForm ? doc : undefined)
    const result = await resolveIssuerWithDoc(shortForm, { kid: '#key-0' }, resolver)
    expect(result.peer4Doc).toBeUndefined()
  })

  it('verifies hash-binding of resolver-returned doc and throws on mismatch', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const ed25519Codec = new Uint8Array([0xed, 0x01])
    const taggedPub = new Uint8Array(ed25519Codec.length + pub.length)
    taggedPub.set(ed25519Codec, 0)
    taggedPub.set(pub, ed25519Codec.length)
    const publicKeyMultibase = encodeMultibase(taggedPub)
    const fakeShortForm = 'did:peer:4zAAAAAAAAAAAAAAAAAAAAAA'
    const resolver = () => ({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#key-0', type: 'Multikey', publicKeyMultibase }],
      authentication: ['#key-0'],
    })
    await expect(
      resolveIssuerWithDoc(fakeShortForm, { kid: '#key-0' }, resolver),
    ).rejects.toThrow(/hash mismatch/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/token test test/resolve-issuer.test.ts`
Expected: FAIL — `resolveIssuerWithDoc` not exported; long-form path either errors with "requires a resolver" or behaves unexpectedly.

- [ ] **Step 3: Refactor `resolveIssuer` to use internal helper**

Replace the relevant portion of `packages/token/src/did.ts` (the `resolveIssuer` function and below) with:

```ts
export type ResolveIssuerHeader = { kid?: string }

export type ResolveIssuerWithDocResult = {
  alg: SignatureAlgorithm
  publicKey: Uint8Array
  /** Present only when iss was a peer:4 long form OR resolver returned a doc — caller may use to populate a cache. */
  peer4Doc?: { shortForm: string; doc: DIDDoc }
}

/**
 * Resolve a token issuer (did:key or did:peer:4) and return alg + public key,
 * plus the decoded peer:4 doc when one was obtained inline or via the resolver.
 * Callers writing to a DID cache should write `peer4Doc` only after signature verification.
 */
export async function resolveIssuerWithDoc(
  iss: string,
  header: ResolveIssuerHeader = {},
  resolver?: DIDResolver,
): Promise<ResolveIssuerWithDocResult> {
  if (isPeer4(iss)) {
    const shortForm = getPeer4ShortForm(iss)

    // Long form: decode inline. No resolver needed. Hash-binding verified by decodePeer4.
    if (iss !== shortForm) {
      const { doc } = decodePeer4(iss)
      const [alg, publicKey] = resolveKidOrAuth(doc, header.kid)
      return { alg, publicKey, peer4Doc: { shortForm, doc } }
    }

    // Short form: must come from resolver.
    if (resolver == null) {
      throw new Error(`Unknown DID: ${shortForm}`)
    }
    const doc = await resolver(shortForm)
    if (doc == null) {
      throw new Error(`Unknown DID: ${shortForm}`)
    }
    // Verify hash-binding of resolver-returned doc.
    const expected = encodePeer4(doc).shortForm
    if (expected !== shortForm) {
      throw new Error('DIDResolver: short form/doc hash mismatch')
    }
    const [alg, publicKey] = resolveKidOrAuth(doc, header.kid)
    return { alg, publicKey, peer4Doc: { shortForm, doc } }
  }

  const [alg, publicKey] = getSignatureInfo(iss)
  return { alg, publicKey }
}

/**
 * Backward-compatible wrapper. Returns [alg, publicKey] without the decoded doc.
 */
export async function resolveIssuer(
  iss: string,
  header: ResolveIssuerHeader = {},
  resolver?: DIDResolver,
): Promise<[SignatureAlgorithm, Uint8Array]> {
  const { alg, publicKey } = await resolveIssuerWithDoc(iss, header, resolver)
  return [alg, publicKey]
}

function resolveKidOrAuth(doc: DIDDoc, kid: string | undefined): [SignatureAlgorithm, Uint8Array] {
  if (kid == null) {
    const auth = doc.authentication
    if (auth == null || auth.length === 0) {
      throw new Error(
        'resolveIssuer: did:peer:4 token missing kid and doc has no authentication entries',
      )
    }
    return resolveKidFromDoc(doc, auth[0])
  }
  return resolveKidFromDoc(doc, kid)
}
```

The existing `resolveKidFromDoc` private function stays as-is. The previous `resolveIssuer` body is fully replaced.

Add `decodePeer4` and `encodePeer4` to the existing peer4 import at the top of `did.ts`:

```ts
import {
  decodePeer4,
  encodePeer4,
  getPeer4ShortForm,
  isPeer4,
  type DIDDoc,
  type VerificationMethod,
} from './peer4.js'
```

- [ ] **Step 4: Export `resolveIssuerWithDoc` and types**

In `packages/token/src/index.ts`, update the `./did.js` export block:

```ts
export {
  CODECS,
  getAlgorithmAndPublicKey,
  getDID,
  getSignatureInfo,
  normalizeDID,
  type ResolveIssuerHeader,
  type ResolveIssuerWithDocResult,
  resolveIssuer,
  resolveIssuerWithDoc,
} from './did.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/token test test/resolve-issuer.test.ts`
Expected: PASS, all existing tests + new long-form inline tests + `resolveIssuerWithDoc` tests.

- [ ] **Step 6: Commit**

```bash
git add packages/token/src/did.ts packages/token/src/index.ts packages/token/test/resolve-issuer.test.ts
git commit -m "feat(token): resolve peer4 long-form iss inline, expose resolveIssuerWithDoc"
```

---

### Task 1.4: `verifyToken` accepts `cache`, defers writes until after sig verify

**Files:**
- Modify: `packages/token/src/token.ts`
- Modify: `packages/token/test/token.test.ts`

- [ ] **Step 1: Write the failing test**

Append a new describe block to `packages/token/test/token.test.ts`:

```ts
import { ed25519 } from '@noble/curves/ed25519.js'
import { createInMemoryDIDCache } from '../src/cache.js'
import { encodeMultibase } from '../src/multibase.js'
import { encodePeer4 } from '../src/peer4.js'
import { createIdentity } from '../src/identity.js'

describe('verifyToken with cache', () => {
  it('populates cache when iss is peer4 long form and signature is valid', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    // Force long form by signing with embedLongForm option (implemented in Task 1.5).
    // For Task 1.4 isolation, hand-construct the token using identity.longForm.
    const payload = { iss: identity.longForm, sub: identity.did, aud: 'someone' }
    const token = await identity.sign(payload)
    await verifyToken(token, { cache })
    const { shortForm } = encodePeer4(identity.doc)
    expect(await cache.get(shortForm)).toEqual(identity.doc)
  })

  it('does NOT populate cache when signature is invalid', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    const payload = { iss: identity.longForm, sub: identity.did, aud: 'someone' }
    const token = await identity.sign(payload)
    // Tamper with the signature.
    const bad = { ...token, signature: 'AAAAAA' }
    await expect(verifyToken(bad, { cache })).rejects.toThrow(/Invalid signature/)
    const { shortForm } = encodePeer4(identity.doc)
    expect(await cache.get(shortForm)).toBeUndefined()
  })

  it('verifies short-form iss against pre-populated cache', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    const { shortForm } = encodePeer4(identity.doc)
    await cache.set(shortForm, identity.doc)
    // Sign with short-form iss (default identity.did is the short form).
    const token = await identity.sign({ sub: identity.did, aud: 'someone' })
    await expect(verifyToken(token, { cache })).resolves.toBeDefined()
  })

  it('falls through to resolver on cache miss', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    const { shortForm } = encodePeer4(identity.doc)
    let resolverHits = 0
    const resolver = (did: string) => {
      resolverHits++
      return did === shortForm ? identity.doc : undefined
    }
    const token = await identity.sign({ sub: identity.did, aud: 'someone' })
    await verifyToken(token, { cache, resolver })
    expect(resolverHits).toBe(1)
    // Subsequent verification hits cache only.
    const token2 = await identity.sign({ sub: identity.did, aud: 'someone-else' })
    await verifyToken(token2, { cache, resolver })
    expect(resolverHits).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @enkaku/token test test/token.test.ts -t "verifyToken with cache"`
Expected: FAIL — `VerifyTokenOptions` does not include `cache`, no cache writes happen.

- [ ] **Step 3: Update `verifyToken` to thread cache, defer writes**

In `packages/token/src/token.ts`:

Change the import block at the top:

```ts
import { b64uToJSON, fromB64U, fromUTF } from '@enkaku/codec'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import { assertType, isType } from '@enkaku/schema'

import type { DIDCache, DIDResolver } from './cache.js'
import { resolveIssuerWithDoc } from './did.js'
import type { SigningIdentity } from './identity.js'
import {
  type SignedPayload,
  validateAlgorithm,
  validateSignedHeader,
  validateSignedPayload,
  validateUnsignedHeader,
} from './schemas.js'
import { assertTimeClaimsValid, type TimeValidationOptions } from './time.js'
import type { SignedToken, Token, UnsignedToken, VerifiedToken } from './types.js'
import { getVerifier, type Verifiers } from './verifier.js'
```

Update `VerifyTokenOptions`:

```ts
export type VerifyTokenOptions = TimeValidationOptions & {
  verifiers?: Verifiers
  resolver?: DIDResolver
  cache?: DIDCache
}
```

Update `VerifySignedPayloadInput`:

```ts
export type VerifySignedPayloadInput<
  Payload extends Record<string, unknown> = Record<string, unknown>,
> = {
  signature: Uint8Array
  payload: Payload
  header: { alg?: string; kid?: string }
  data: Uint8Array | string
  verifiers?: Verifiers
  resolver?: DIDResolver
  cache?: DIDCache
}
```

Replace `verifySignedPayload`:

```ts
export async function verifySignedPayload<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(input: VerifySignedPayloadInput<Payload>): Promise<Uint8Array> {
  const { signature, payload, header, data, verifiers, resolver, cache } = input
  assertType(validateSignedPayload, payload)
  const { alg, publicKey, peer4Doc } = await resolveIssuerWithDoc(
    payload.iss,
    { kid: header.kid },
    resolver,
  )
  const verify = getVerifier(alg, verifiers)
  const message = typeof data === 'string' ? fromUTF(data) : data
  const verified = await verify(signature, message, publicKey)
  if (!verified) {
    throw new Error('Invalid signature')
  }
  if (cache != null && peer4Doc != null) {
    await cache.set(peer4Doc.shortForm, peer4Doc.doc)
  }
  return publicKey
}
```

In `verifyTokenInner`, update both call sites that pass options into `verifySignedPayload`:

Find:
```ts
    if (isSignedToken(token)) {
      const verifiedPublicKey = await verifySignedPayload({
        signature: fromB64U(token.signature),
        payload: token.payload,
        header: token.header as { alg?: string; kid?: string },
        data: token.data,
        verifiers,
        resolver,
      })
```
Replace with:
```ts
    if (isSignedToken(token)) {
      const verifiedPublicKey = await verifySignedPayload({
        signature: fromB64U(token.signature),
        payload: token.payload,
        header: token.header as { alg?: string; kid?: string },
        data: token.data,
        verifiers,
        resolver,
        cache,
      })
```

Find the second call site (string-parsing branch):
```ts
    const verifiedPublicKey = await verifySignedPayload({
      signature: fromB64U(signature),
      payload,
      header: header as { alg?: string; kid?: string },
      data,
      verifiers,
      resolver,
    })
```
Replace with:
```ts
    const verifiedPublicKey = await verifySignedPayload({
      signature: fromB64U(signature),
      payload,
      header: header as { alg?: string; kid?: string },
      data,
      verifiers,
      resolver,
      cache,
    })
```

In the destructuring at the top of `verifyTokenInner`, add `cache`:

Find:
```ts
  const { verifiers, resolver, ...timeOptions } = options
```
Replace with:
```ts
  const { verifiers, resolver, cache, ...timeOptions } = options
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/token test test/token.test.ts`
Expected: PASS, all existing tests + 4 new cache-related tests.

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/token.ts packages/token/test/token.test.ts
git commit -m "feat(token): verifyToken accepts DIDCache, defers cache writes until after sig verify"
```

---

### Task 1.5: `MultiKeyIdentity.sign` `embedLongForm` + first-per-aud policy

**Files:**
- Modify: `packages/token/src/identity.ts`
- Modify: `packages/token/test/identity.test.ts`

- [ ] **Step 1: Write the failing test**

Append a new describe block to `packages/token/test/identity.test.ts`:

```ts
describe('MultiKeyIdentity.sign first-per-aud long-form policy', () => {
  it('uses long form on first token to a new aud, short form thereafter', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const aud = 'did:example:bob'
    const t1 = await identity.sign({ sub: identity.did, aud })
    expect(t1.payload.iss).toBe(identity.longForm)
    const t2 = await identity.sign({ sub: identity.did, aud })
    expect(t2.payload.iss).toBe(identity.did) // short form
  })

  it('uses long form again for a different aud', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    await identity.sign({ sub: identity.did, aud: 'did:example:bob' })
    const t = await identity.sign({ sub: identity.did, aud: 'did:example:alice' })
    expect(t.payload.iss).toBe(identity.longForm)
  })

  it('uses short form by default when payload has no aud', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const t = await identity.sign({ sub: identity.did })
    expect(t.payload.iss).toBe(identity.did)
  })

  it('embedLongForm:true forces long form even on repeat aud', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const aud = 'did:example:bob'
    await identity.sign({ sub: identity.did, aud })
    const t = await identity.sign({ sub: identity.did, aud }, { embedLongForm: true })
    expect(t.payload.iss).toBe(identity.longForm)
  })

  it('embedLongForm:false forces short form even on first contact', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const t = await identity.sign(
      { sub: identity.did, aud: 'did:example:bob' },
      { embedLongForm: false },
    )
    expect(t.payload.iss).toBe(identity.did)
  })

  it('did:key identities always use short form (no peer4 long form exists)', async () => {
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const t1 = await identity.sign({ sub: identity.did, aud: 'did:example:bob' })
    expect(t1.payload.iss).toBe(identity.did)
    const t2 = await identity.sign(
      { sub: identity.did, aud: 'did:example:bob' },
      { embedLongForm: true },
    )
    // For did:key, longForm === did, so iss stays the same.
    expect(t2.payload.iss).toBe(identity.did)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @enkaku/token test test/identity.test.ts -t "first-per-aud"`
Expected: FAIL — `embedLongForm` not supported; iss is always short form.

- [ ] **Step 3: Update `SignOptions` and `MultiKeyIdentity.sign`**

In `packages/token/src/identity.ts`:

Update `SignOptions`:

```ts
export type SignOptions = {
  kid?: string
  /**
   * Override the first-per-aud long-form policy.
   * - true: always use long form (no-op for did:key).
   * - false: always use short form, regardless of whether aud has been seen.
   * - undefined (default): use long form on first token to a given payload.aud, short form thereafter.
   */
  embedLongForm?: boolean
}
```

Replace `buildIdentity` with:

```ts
function buildIdentity(
  did: string,
  longForm: string,
  doc: DIDDoc,
  keys: Array<ResolvedKey>,
): MultiKeyIdentity {
  const sentTo = new Set<string>()
  const isPeer = isPeer4(did)

  function pickIss(payload: Record<string, unknown>, embedLongForm: boolean | undefined): string {
    if (!isPeer) return did
    if (embedLongForm === true) return longForm
    if (embedLongForm === false) return did
    const aud = payload.aud
    if (typeof aud !== 'string') return did
    if (sentTo.has(aud)) return did
    sentTo.add(aud)
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
    return decryptToken({ id: did, decrypt, agreeKey }, jwe)
  }

  return { did, longForm, doc, keys, sign, decrypt, agreeKey }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @enkaku/token test test/identity.test.ts`
Expected: PASS, all existing identity tests + 6 new policy tests.

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/identity.ts packages/token/test/identity.test.ts
git commit -m "feat(token): MultiKeyIdentity.sign first-per-aud long-form policy + embedLongForm override"
```

---

### Gate 1 verification

- [ ] **Step 1: Run full token package suite**

Run: `pnpm --filter @enkaku/token test`
Expected: all tests pass.

- [ ] **Step 2: Run full workspace build + lint + tests**

Run: `pnpm run build && pnpm run lint && pnpm run test`
Expected: clean.

- [ ] **Step 3: Update plan stage**

Edit `docs/superpowers/plans/2026-05-26-did-peer-4-transport-integration.md`: change `**Stage:** planning` to `**Stage:** executing — Gate 1 complete`.

- [ ] **Step 4: Commit stage advance**

```bash
git add docs/superpowers/plans/2026-05-26-did-peer-4-transport-integration.md
git commit -m "chore: advance peer4 integration plan past Gate 1"
```

---

## Stage 2 — Capability delegation (Gate 2)

File structure for this stage:

| File | Action | Responsibility |
|---|---|---|
| `packages/capability/src/index.ts` | modify | `DelegationChainOptions.cache/resolver`; normalize `iss/aud/sub` comparisons in `assertValidDelegation`, `checkDelegationChain`, `checkCapability`. |
| `packages/capability/test/delegation-peer4.test.ts` | create | Full delegation matrix per Gate 2. |

`@enkaku/capability/package.json` must depend on `@enkaku/token` (already does).

---

### Task 2.1: Thread `cache` and `resolver` through `DelegationChainOptions`

**Files:**
- Modify: `packages/capability/src/index.ts`

- [ ] **Step 1: Add fields to `DelegationChainOptions`**

In `packages/capability/src/index.ts`, find:

```ts
export type DelegationChainOptions = {
  atTime?: number
  maxDepth?: number
  verifyToken?: VerifyTokenHook
}
```

Replace with:

```ts
import type { DIDCache, DIDResolver } from '@enkaku/token'

export type DelegationChainOptions = {
  atTime?: number
  maxDepth?: number
  verifyToken?: VerifyTokenHook
  /** Optional DID cache for resolving did:peer:4 issuers. Populated on long-form first contact. */
  cache?: DIDCache
  /** Optional resolver for did:peer:4 short forms not in cache. */
  resolver?: DIDResolver
}
```

(If `@enkaku/token` import block already exists at the top of the file, add `DIDCache, DIDResolver` to it instead of adding a new import statement.)

- [ ] **Step 2: Thread into recursive `verifyToken` calls**

Find both call sites in this file (`checkDelegationChain` and `checkCapability`):

```ts
  const next = await verifyToken<CapabilityPayload>(head, { atTime })
```
Replace with:
```ts
  const next = await verifyToken<CapabilityPayload>(head, {
    atTime,
    cache: options?.cache,
    resolver: options?.resolver,
  })
```

```ts
  const capability = await verifyToken<CapabilityPayload>(head, { atTime: time })
```
Replace with:
```ts
  const capability = await verifyToken<CapabilityPayload>(head, {
    atTime: time,
    cache: options?.cache,
    resolver: options?.resolver,
  })
```

- [ ] **Step 3: Build the package to check types**

Run: `pnpm --filter @enkaku/capability build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "feat(capability): thread DIDCache and DIDResolver through delegation chain options"
```

---

### Task 2.2: Normalize DID comparisons

**Files:**
- Modify: `packages/capability/src/index.ts`

- [ ] **Step 1: Import `normalizeDID`**

In the `@enkaku/token` import block at the top, add `normalizeDID`:

```ts
import {
  isVerifiedToken,
  normalizeDID,
  type SignedHeader,
  type SignedPayload,
  type SignedToken,
  type SigningIdentity,
  verifyToken,
  type DIDCache,
  type DIDResolver,
} from '@enkaku/token'
```

- [ ] **Step 2: Normalize in `assertValidDelegation`**

Find:

```ts
export function assertValidDelegation(
  from: CapabilityPayload,
  to: CapabilityPayload,
  atTime?: number,
): void {
  const time = atTime ?? now()
  if (to.iss !== from.aud) {
    throw new Error('Invalid capability: audience mismatch')
  }
  if (to.sub !== from.sub) {
    throw new Error('Invalid capability: subject mismatch')
  }
```

Replace the two comparisons:

```ts
  if (normalizeDID(to.iss) !== normalizeDID(from.aud)) {
    throw new Error('Invalid capability: audience mismatch')
  }
  if (normalizeDID(to.sub) !== normalizeDID(from.sub)) {
    throw new Error('Invalid capability: subject mismatch')
  }
```

- [ ] **Step 3: Normalize in `checkDelegationChain` base case**

Find inside `checkDelegationChain`:

```ts
  if (capabilities.length === 0) {
    if (payload.iss !== payload.sub) {
      throw new Error('Invalid capability: issuer should be subject')
    }
```

Replace:

```ts
  if (capabilities.length === 0) {
    if (normalizeDID(payload.iss) !== normalizeDID(payload.sub)) {
      throw new Error('Invalid capability: issuer should be subject')
    }
```

- [ ] **Step 4: Normalize in `checkCapability` self-issued check**

Find:

```ts
  if (payload.iss === payload.sub) {
    // Subject is issuer, no delegation required
```

Replace:

```ts
  if (normalizeDID(payload.iss) !== null && normalizeDID(payload.iss) === normalizeDID(payload.sub)) {
    // Subject is issuer, no delegation required
```

(Two `normalizeDID` calls — `iss` is already validated non-null by `payload.sub == null` check above; left side is defensive only against undefined. If linter flags, simplify back to `normalizeDID(payload.iss) === normalizeDID(payload.sub)` — the `payload.sub == null` guard already runs first.)

Simpler form (use this):

```ts
  if (normalizeDID(payload.iss) === normalizeDID(payload.sub)) {
    // Subject is issuer, no delegation required
```

- [ ] **Step 5: Normalize in `createCapability` (parent comparison)**

Find:

```ts
  // Signer must be the audience of the parent capability
  if (parent.payload.aud !== signerId) {
    throw new Error('Invalid capability: signer must be the audience of parent capability')
  }

  // Subject must match
  if (parent.payload.sub !== payload.sub) {
```

Replace:

```ts
  if (normalizeDID(parent.payload.aud) !== normalizeDID(signerId)) {
    throw new Error('Invalid capability: signer must be the audience of parent capability')
  }

  if (normalizeDID(parent.payload.sub) !== normalizeDID(payload.sub)) {
```

- [ ] **Step 6: Build to check types**

Run: `pnpm --filter @enkaku/capability build`
Expected: clean.

- [ ] **Step 7: Run existing tests to confirm no regressions**

Run: `pnpm --filter @enkaku/capability test`
Expected: all existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/capability/src/index.ts
git commit -m "feat(capability): normalize peer4 long/short forms in delegation equality checks"
```

---

### Task 2.3: Delegation matrix tests (Gate 2 core)

**Files:**
- Create: `packages/capability/test/delegation-peer4.test.ts`

- [ ] **Step 1: Write the full matrix test file**

Create `packages/capability/test/delegation-peer4.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createInMemoryDIDCache,
  createIdentity,
  type MultiKeyIdentity,
  stringifyToken,
} from '@enkaku/token'

import { checkCapability, checkDelegationChain, type DelegationChainOptions } from '../src/index.js'

async function makePeer4(): Promise<MultiKeyIdentity> {
  return await createIdentity({
    keys: [{ purpose: 'sig', alg: 'EdDSA' }],
    didMethod: 'peer:4',
  })
}

async function rootCap(
  signer: MultiKeyIdentity,
  audience: MultiKeyIdentity,
  embedLongForm: boolean,
  options?: { audAsLong?: boolean },
) {
  const aud = options?.audAsLong === true ? audience.longForm : audience.did
  return await signer.sign(
    {
      sub: signer.did,
      aud,
      act: 'foo',
      res: signer.did,
    },
    { embedLongForm },
  )
}

describe('Gate 2 — peer4 delegation matrix', () => {
  // Cell 2a: root cap signed long, leaf request short.
  it('2a: root long-form, leaf short-form, single hop verifies', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const cap = await rootCap(alice, bob, true /* embed long */)
    const cache = createInMemoryDIDCache()
    const options: DelegationChainOptions = { cache }
    // Leaf request from bob with short-form iss.
    const leafPayload = {
      sub: bob.did,
      aud: alice.did,
      cap: [stringifyToken(cap)],
    }
    const leaf = await bob.sign({ ...leafPayload, sub: bob.did }, { embedLongForm: false })
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload, options),
    ).resolves.toBeUndefined()
    // Cache should now hold alice's doc.
    expect(await cache.get(alice.did)).toBeDefined()
  })

  // Cell 2b: root short-form (precached), leaf long-form.
  it('2b: root short-form, leaf long-form, single hop verifies', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const cap = await rootCap(alice, bob, false /* short */)
    const cache = createInMemoryDIDCache()
    await cache.set(alice.did, alice.doc) // precache alice for short-form root
    const options: DelegationChainOptions = { cache }
    const leaf = await bob.sign(
      { sub: bob.did, aud: alice.did, cap: [stringifyToken(cap)] },
      { embedLongForm: true },
    )
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload, options),
    ).resolves.toBeUndefined()
    expect(await cache.get(bob.did)).toBeDefined()
  })

  // Cell 2c: multi-hop alice -> bob -> carol, mixed forms.
  it('2c: 3-hop chain with mixed forms verifies and populates cache transitively', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    const carol = await makePeer4()
    // Root cap: alice -> bob, long form for alice (first contact with bob).
    const rootBob = await alice.sign(
      { sub: alice.did, aud: bob.did, act: 'foo', res: alice.did },
      { embedLongForm: true },
    )
    // Sub-cap: bob delegates to carol, long form (bob first contact with carol).
    const subCarol = await bob.sign(
      { sub: alice.did, aud: carol.did, act: 'foo', res: alice.did, cap: [stringifyToken(rootBob)] },
      { embedLongForm: true },
    )
    const cache = createInMemoryDIDCache()
    const leaf = await carol.sign(
      {
        sub: alice.did,
        aud: alice.did,
        cap: [stringifyToken(subCarol)],
      },
      { embedLongForm: true },
    )
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload, { cache }),
    ).resolves.toBeUndefined()
    expect(await cache.get(alice.did)).toBeDefined()
    expect(await cache.get(bob.did)).toBeDefined()
    expect(await cache.get(carol.did)).toBeDefined()
  })

  // Cell 2d covered in server-layer Stage 3 (access-rule allow lists live there).

  // Cell 2e: did:key regression — identical flow with did:key identities.
  it('2e: did:key delegation still works (regression)', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    const cap = await alice.sign({
      sub: alice.did,
      aud: bob.did,
      act: 'foo',
      res: alice.did,
    })
    const leaf = await bob.sign({
      sub: bob.did,
      aud: alice.did,
      cap: [stringifyToken(cap)],
    })
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, leaf.payload),
    ).resolves.toBeUndefined()
  })

  // Cell 2f: self-issued short-circuit with mixed forms of same identity.
  it('2f: iss=long, sub=short of same peer4 identity short-circuits self-issued', async () => {
    const alice = await makePeer4()
    // Hand-craft a capability token where iss=long, sub=short.
    const cap = await alice.sign(
      { sub: alice.did, act: 'foo', res: alice.did },
      { embedLongForm: true },
    )
    // cap.payload.iss === alice.longForm, cap.payload.sub === alice.did (short).
    expect(cap.payload.iss).toBe(alice.longForm)
    expect(cap.payload.sub).toBe(alice.did)
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, cap.payload),
    ).resolves.toBeUndefined()
  })

  it('2f: iss=alice, sub=bob (different identities) does NOT short-circuit even if both peer4', async () => {
    const alice = await makePeer4()
    const bob = await makePeer4()
    // Payload simulating a token where alice claims bob as sub without a cap chain.
    const payload = {
      iss: alice.did,
      sub: bob.did,
    } as any
    await expect(
      checkCapability({ act: 'foo', res: alice.did }, payload),
    ).rejects.toThrow(/no capability|Invalid payload/i)
  })
})
```

- [ ] **Step 2: Run the matrix tests**

Run: `pnpm --filter @enkaku/capability test test/delegation-peer4.test.ts`
Expected: all 6 tests PASS.

**Stop-and-surface trigger:** if any single cell fails, do NOT debug ad-hoc. Write a finding doc:

```bash
mkdir -p docs/agents/findings
```

Create `docs/agents/findings/2026-05-26-peer4-delegation-<cell-id>.md` with:

```markdown
# Gate 2 failure: <cell id>

**Inputs:** [exact identities, payloads]
**Expected:** [behavior the test asserts]
**Observed:** [actual error or behavior]
**Hypothesis:** [best guess at root cause]
```

Halt plan execution and report to user. Do not proceed to Stage 3.

- [ ] **Step 3: Run full capability suite for regressions**

Run: `pnpm --filter @enkaku/capability test`
Expected: all tests pass, including pre-existing did:key tests.

- [ ] **Step 4: Commit**

```bash
git add packages/capability/test/delegation-peer4.test.ts
git commit -m "test(capability): Gate 2 delegation matrix for did:peer:4"
```

---

### Gate 2 verification

- [ ] **Step 1: Workspace build + lint + tests**

Run: `pnpm run build && pnpm run lint && pnpm run test`
Expected: clean.

- [ ] **Step 2: Update plan stage**

Edit the plan: change Stage line to `**Stage:** executing — Gate 2 complete`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-26-did-peer-4-transport-integration.md
git commit -m "chore: advance peer4 integration plan past Gate 2"
```

---

## Stage 3 — Server wiring (Gate 3)

File structure for this stage:

| File | Action | Responsibility |
|---|---|---|
| `packages/server/src/server.ts` | modify | `EnkakuServer` ctor + `handleMessages` accept `cache`, `resolver`; outer-message verify; thread to `checkClientToken`. |
| `packages/server/src/access-control.ts` | modify | Normalize `iss/sub/aud` comparisons against `serverID`; normalize `allow` list entries. |
| `packages/server/test/peer4-handshake.test.ts` | create | End-to-end peer4 handshake over in-process transport. |

---

### Task 3.1: Audit outer-message signature verification (Gate 3 stop-and-surface)

**Files:**
- Read: `packages/server/src/server.ts`
- Read: `packages/server/src/handlers/*.ts`

- [ ] **Step 1: Search for any call that verifies the outer message signature**

Run: `grep -rn "verifyToken\b\|verifySignedPayload" packages/server/src/`

Expected behavior to determine — does the server currently verify the outer message's JWS signature before dispatching to access-control or handlers? `isSignedToken` is a shape check, not a signature check.

- [ ] **Step 2: Search for any wrapper layer that does it**

Run: `grep -rn "verifyToken\b\|verifySignedPayload" packages/runtime/src/ packages/transport/src/ packages/message-transport/src/ packages/protocol/src/`

- [ ] **Step 3: Determine outcome**

If verification IS happening (in capability layer through `checkCapability` → `verifyToken` on the outer message, or anywhere else): proceed to Task 3.2. Document the location in a comment in `server.ts` near `checkClientToken` invocation: `// outer-message signature verified at <location>` so future maintainers can find it.

If verification IS NOT happening anywhere (server accepts a forged signed-shape token whose signature was never checked): **stop, surface as critical security finding, do not proceed.**

Write `docs/agents/findings/2026-05-26-server-outer-signature-gap.md`:

```markdown
# Critical: server outer-message signature is not verified

**Reproduction:** Send a SignedToken-shaped message to EnkakuServer.handleMessages with a tampered signature. Observe whether access-control rejects it.

**Expected:** rejection at signature-verify boundary before access-control.
**Observed:** [actual behavior found in audit]

**Recommended fix scope:** add `verifyToken(message, { cache, resolver, verifiers })` call before `checkClientToken` in `server.ts`. Investigate why this gap exists (intentional layering, or oversight). Pre-existing did:key authentication may have relied on transport-layer guarantees that don't exist.

**Action:** This is out of scope for the peer4 transport-integration plan. Halt that plan pending dedicated security fix.
```

Halt plan and report to user. Do not proceed to Task 3.2.

- [ ] **Step 4: Commit findings (only if audit clean and proceeding)**

If proceeding, no commit needed. The audit is documentation.

---

### Task 3.2: `EnkakuServer` accepts `cache` and `resolver`

**Files:**
- Modify: `packages/server/src/server.ts`

- [ ] **Step 1: Add fields to `AccessControlParams`**

In `packages/server/src/server.ts`, find:

```ts
export type AccessControlParams = (
  | { requireAuth: false; serverID?: string; access: AccessRules }
  | { requireAuth: true; serverID: string; access: AccessRules }
) & { encryptionPolicy?: EncryptionPolicy; verifyToken?: VerifyTokenHook }
```

Replace with:

```ts
import type { DIDCache, DIDResolver } from '@enkaku/token'

export type AccessControlParams = (
  | { requireAuth: false; serverID?: string; access: AccessRules }
  | { requireAuth: true; serverID: string; access: AccessRules }
) & {
  encryptionPolicy?: EncryptionPolicy
  verifyToken?: VerifyTokenHook
  cache?: DIDCache
  resolver?: DIDResolver
}
```

If the file already imports from `@enkaku/token`, add `DIDCache, DIDResolver` to the existing import instead of adding a new statement.

- [ ] **Step 2: Thread `cache` and `resolver` into every `checkClientToken` call**

Find the existing line (around server.ts:442-447):

```ts
          await checkClientToken(
            params.serverID,
            params.access,
            message as unknown as SignedToken,
            params.verifyToken != null ? { verifyToken: params.verifyToken } : undefined,
          )
```

Replace with:

```ts
          await checkClientToken(
            params.serverID,
            params.access,
            message as unknown as SignedToken,
            {
              verifyToken: params.verifyToken,
              cache: params.cache,
              resolver: params.resolver,
            },
          )
```

- [ ] **Step 3: Thread into `EnkakuServer` constructor**

Find the `EnkakuServer` class fields and constructor (search for `class EnkakuServer`). Add `#cache` and `#resolver` fields, accept them in the constructor options, store them, and forward them in every `handleMessages` invocation.

Locate the constructor accepting `EnkakuServerOptions` and add:

```ts
  #cache?: DIDCache
  #resolver?: DIDResolver
```

In the constructor, add:

```ts
    this.#cache = options.cache
    this.#resolver = options.resolver
```

(Where the existing options destructuring happens.)

Find the `EnkakuServerOptions` type, add:

```ts
  cache?: DIDCache
  resolver?: DIDResolver
```

In each `handleMessages` call inside the class (lines around 700, 708, 745, 760, 766 from the audit earlier), add:

```ts
        cache: this.#cache,
        resolver: this.#resolver,
```

next to the existing `verifyToken: this.#accessControl.verifyToken` (or equivalent) lines.

- [ ] **Step 4: Build to check types**

Run: `pnpm --filter @enkaku/server build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/server.ts
git commit -m "feat(server): EnkakuServer accepts DIDCache and DIDResolver, threads through access-control"
```

---

### Task 3.3: `access-control.ts` normalization

**Files:**
- Modify: `packages/server/src/access-control.ts`

- [ ] **Step 1: Import `normalizeDID`**

At the top of `packages/server/src/access-control.ts`, add `normalizeDID` to the `@enkaku/token` import:

```ts
import { normalizeDID, type SignedToken } from '@enkaku/token'
```

- [ ] **Step 2: Normalize in `checkClientToken`**

Find:

```ts
  if (payload.iss === serverID) {
```
Replace:
```ts
  if (normalizeDID(payload.iss) === normalizeDID(serverID)) {
```

Find:

```ts
    if (payload.aud != null && payload.aud !== serverID) {
```
Replace:
```ts
    if (payload.aud != null && normalizeDID(payload.aud) !== normalizeDID(serverID)) {
```

Find:

```ts
  if (payload.sub === serverID) {
```
Replace:
```ts
  if (normalizeDID(payload.sub) === normalizeDID(serverID)) {
```

Find:

```ts
  if (payload.aud !== serverID) {
```
Replace:
```ts
  if (normalizeDID(payload.aud) !== normalizeDID(serverID)) {
```

- [ ] **Step 3: Normalize in `checkProcedureAccess` allow list**

Find:

```ts
    if (Array.isArray(allow)) {
      if (allow.includes(payload.iss)) return
      if (payload.sub != null && allow.includes(payload.sub)) {
```

Replace with:

```ts
    if (Array.isArray(allow)) {
      const normalizedAllow = allow.map(normalizeDID)
      const normalizedIss = normalizeDID(payload.iss)
      if (normalizedAllow.includes(normalizedIss)) return
      if (payload.sub != null) {
        const normalizedSub = normalizeDID(payload.sub)
        if (normalizedAllow.includes(normalizedSub)) {
```

(Keep the original `if (await verifyDelegation()) return` line and the `continue` line unchanged; just adjust the nesting.)

Full replaced block:

```ts
    if (Array.isArray(allow)) {
      const normalizedAllow = allow.map(normalizeDID)
      const normalizedIss = normalizeDID(payload.iss)
      if (normalizedAllow.includes(normalizedIss)) return
      if (payload.sub != null) {
        const normalizedSub = normalizeDID(payload.sub)
        if (normalizedAllow.includes(normalizedSub)) {
          if (await verifyDelegation()) return
        }
      }
      continue
    }
```

- [ ] **Step 4: Run existing access-control tests**

Run: `pnpm --filter @enkaku/server test test/access-control.test.ts test/access-control-config.test.ts test/access-control-deny.test.ts test/access-control-predicate.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/access-control.ts
git commit -m "feat(server): normalize peer4 DID forms in access-control comparisons"
```

---

### Task 3.4: End-to-end peer4 handshake test (Gate 3 integration)

**Files:**
- Create: `packages/server/test/peer4-handshake.test.ts`

- [ ] **Step 1: Inspect existing access-control test for setup pattern**

Run: `head -80 packages/server/test/access-control.test.ts`

The pattern likely uses `MessageTransport` or an in-process protocol harness. Match it.

- [ ] **Step 2: Write the peer4-handshake test**

Create `packages/server/test/peer4-handshake.test.ts`. Use the same protocol/transport harness used by `access-control.test.ts` (read it first to confirm imports). The skeleton below sketches the assertions — adapt the harness setup to match `access-control.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createIdentity,
  createInMemoryDIDCache,
  stringifyToken,
  type MultiKeyIdentity,
} from '@enkaku/token'

// Import the same protocol + EnkakuServer + transport harness used in access-control.test.ts.
// (Inspect that file and copy its imports.)

describe('Gate 3 — peer4 client/server handshake', () => {
  it('first request from a peer4 client uses long-form iss; cache populates; second uses short-form', async () => {
    const serverIdentity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const clientIdentity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const cache = createInMemoryDIDCache()
    // Spin up EnkakuServer with serverID: serverIdentity.did, cache, access rule: allow: [clientIdentity.did]
    // Send a signed request token from clientIdentity to server.
    // Inspect the token sent: payload.iss === clientIdentity.longForm.
    // Assert handler ran successfully.
    // Assert cache.get(clientIdentity.did) is now defined.
    // Send a second request: payload.iss === clientIdentity.did (short).
    // Assert handler ran successfully again.
    // TODO: adapt to the actual server-test harness; the assertions above are the contract.
    expect(serverIdentity.did).toBeDefined()
    expect(clientIdentity.did).toBeDefined()
  })

  it('peer4 server rejects a forged-signature outer message', async () => {
    // Build a SignedToken-shaped message with a tampered signature field.
    // Assert the server emits an EK02 access-denied response (or whichever error code is correct
    // — verify by reading the existing handler tests).
  })

  it('peer4 client with did:peer:4 issuer is rejected when cache is empty and no resolver is wired (UnknownDID)', async () => {
    // Build a client token with short-form iss only.
    // Server has no cache entry, no resolver.
    // Assert rejection with reason containing "Unknown DID" or equivalent EK02.
  })

  it('peer4 client succeeds when server has a resolver returning the doc', async () => {
    // Server constructed with resolver: (did) => clientIdentity.doc if did matches.
    // Client sends short-form-only token.
    // Assert success.
  })
})
```

**Note:** the second/third/fourth tests are stubbed for the engineer to flesh out using the in-process protocol harness from `access-control.test.ts`. The test bodies should mirror the existing patterns — do not invent new harness code.

- [ ] **Step 3: Run the test file**

Run: `pnpm --filter @enkaku/server test test/peer4-handshake.test.ts`
Expected: PASS after the harness adaptations are in place.

If a stub fails because the harness has no path for the assertion, do NOT skip it. Adapt the test to the harness. The four scenarios are required for Gate 3.

- [ ] **Step 4: Run full server suite**

Run: `pnpm --filter @enkaku/server test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/server/test/peer4-handshake.test.ts
git commit -m "test(server): Gate 3 end-to-end peer4 handshake over in-process transport"
```

---

### Gate 3 verification

- [ ] **Step 1: Workspace build + lint + tests**

Run: `pnpm run build && pnpm run lint && pnpm run test`
Expected: clean.

- [ ] **Step 2: Update plan stage**

Edit plan: `**Stage:** executing — Gate 3 complete`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-26-did-peer-4-transport-integration.md
git commit -m "chore: advance peer4 integration plan past Gate 3"
```

---

## Stage 4 — Group wiring (Gate 4)

File structure for this stage:

| File | Action | Responsibility |
|---|---|---|
| `packages/group/src/credential.ts` | modify | `SerializedCredential.longForm?`; emission embeds longForm for peer4; decode populates cache. |
| `packages/group/src/group.ts` | modify | `GroupOptions.cache`; pass cache to capability checks; populate from credential on member-state advancement. |
| `packages/group/src/types.ts` | modify | `GroupOptions.cache?: DIDCache`. |
| `packages/group/test/peer4-credential.test.ts` | create | Two-member peer4 group join, mixed peer4/did:key, short-form app messages. |

---

### Task 4.1: Extend `SerializedCredential` with optional `longForm`

**Files:**
- Modify: `packages/group/src/credential.ts`

- [ ] **Step 1: Update the type**

In `packages/group/src/credential.ts`, find:

```ts
export type SerializedCredential = {
  did: string
  groupID: string
  capabilityChain: Array<string>
}
```

Replace with:

```ts
export type SerializedCredential = {
  did: string
  groupID: string
  capabilityChain: Array<string>
  /** did:peer:4 long form (with embedded doc). Present only when did is a did:peer:4 short form. */
  longForm?: string
}
```

- [ ] **Step 2: Update `credentialToMLSIdentity` to embed long form when peer4**

Add imports at the top:

```ts
import { isPeer4 } from '@enkaku/token'
```

Update the function:

```ts
export function credentialToMLSIdentity(
  credential: MemberCredential,
  options: { longForm?: string } = {},
): Uint8Array {
  const serialized: SerializedCredential = {
    did: credential.did,
    groupID: credential.groupID,
    capabilityChain: credential.capabilityChain,
  }
  if (options.longForm != null && isPeer4(credential.did)) {
    serialized.longForm = options.longForm
  }
  return new TextEncoder().encode(JSON.stringify(serialized))
}
```

- [ ] **Step 3: Update `mlsIdentityToSerializedCredential` to parse and validate `longForm`**

Replace:

```ts
export function mlsIdentityToSerializedCredential(identity: Uint8Array): SerializedCredential {
  const json = new TextDecoder().decode(identity)
  const parsed: unknown = JSON.parse(json)
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).did !== 'string' ||
    typeof (parsed as Record<string, unknown>).groupID !== 'string' ||
    !Array.isArray((parsed as Record<string, unknown>).capabilityChain)
  ) {
    throw new Error('Invalid MLS credential: malformed serialized credential')
  }
  return parsed as SerializedCredential
}
```

With:

```ts
export function mlsIdentityToSerializedCredential(identity: Uint8Array): SerializedCredential {
  const json = new TextDecoder().decode(identity)
  const parsed: unknown = JSON.parse(json)
  if (
    parsed == null ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).did !== 'string' ||
    typeof (parsed as Record<string, unknown>).groupID !== 'string' ||
    !Array.isArray((parsed as Record<string, unknown>).capabilityChain)
  ) {
    throw new Error('Invalid MLS credential: malformed serialized credential')
  }
  const candidate = parsed as Record<string, unknown>
  if ('longForm' in candidate && typeof candidate.longForm !== 'string') {
    throw new Error('Invalid MLS credential: longForm must be a string when present')
  }
  return parsed as SerializedCredential
}
```

- [ ] **Step 4: Add helper `populateCacheFromCredential`**

At the end of the file:

```ts
import { decodePeer4, type DIDCache, isPeer4 } from '@enkaku/token'

/**
 * If the serialized credential carries a did:peer:4 long form, decode it and write to the cache.
 * Hash binding enforced by decodePeer4 + cache.set.
 */
export async function populateCacheFromCredential(
  serialized: SerializedCredential,
  cache: DIDCache,
): Promise<void> {
  if (serialized.longForm == null) return
  if (!isPeer4(serialized.did)) return
  const { shortForm, doc } = decodePeer4(serialized.longForm)
  if (shortForm !== serialized.did) {
    throw new Error('Credential longForm does not match credential.did')
  }
  await cache.set(shortForm, doc)
}
```

Merge with the existing top imports (don't keep two `import { ... } from '@enkaku/token'` blocks — combine):

```ts
import { decodePeer4, type DIDCache, isPeer4 } from '@enkaku/token'
```

- [ ] **Step 5: Build to check types**

Run: `pnpm --filter @enkaku/group build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/group/src/credential.ts
git commit -m "feat(group): SerializedCredential carries optional peer4 longForm"
```

---

### Task 4.2: `GroupOptions.cache` and credential population on member events

**Files:**
- Modify: `packages/group/src/types.ts`
- Modify: `packages/group/src/group.ts`

- [ ] **Step 1: Add `cache` to `GroupOptions`**

In `packages/group/src/types.ts`, find `GroupOptions` and add:

```ts
import type { DIDCache } from '@enkaku/token'

export type GroupOptions = {
  // ... existing fields
  cache?: DIDCache
}
```

(Merge with existing imports if `@enkaku/token` is already imported. Add `cache?: DIDCache` to the existing `GroupOptions` field list.)

- [ ] **Step 2: Thread `cache` into `GroupHandle`**

In `packages/group/src/group.ts`, find the `GroupHandle` class. Add a field for the cache and accept it in `GroupHandleParams`:

```ts
import { createInMemoryDIDCache, type DIDCache } from '@enkaku/token'

export type GroupHandleParams = {
  state: ClientState
  credential: MemberCredential
  context: MlsContext
  rootCapability: string
  cache: DIDCache
}
```

In the class:

```ts
  #cache: DIDCache
```

In the constructor:

```ts
    this.#cache = params.cache
```

Expose a getter:

```ts
  get cache(): DIDCache {
    return this.#cache
  }
```

- [ ] **Step 3: Populate cache on member-state advancement**

Find the code path that processes Welcome, Add, or Commit messages (search for `mlsProcessMessage` calls and the surrounding member-credential extraction). At every point where a remote member's MLS basic credential is parsed back into a `SerializedCredential`, call `populateCacheFromCredential(serialized, this.#cache)`.

Concretely:
- Find `mlsIdentityToSerializedCredential` call sites in `group.ts`. After each, await `populateCacheFromCredential(serialized, this.#cache)`.
- Also do this at group creation when serializing self-credential (so the local cache knows about self — useful for symmetric tests).

Add import at top:

```ts
import {
  credentialToMLSIdentity,
  mlsIdentityToSerializedCredential,
  populateCacheFromCredential,
  type MemberCredential,
} from './credential.js'
```

- [ ] **Step 4: Update credential emission to include long form for peer4 identities**

Find every call to `credentialToMLSIdentity(credential)`. The caller has access to a `SigningIdentity` or `MultiKeyIdentity` for the local member. When that identity is peer4 (i.e. `identity.longForm !== identity.did`), pass its long form:

```ts
const longForm = isPeer4(identity.did) ? (identity as MultiKeyIdentity).longForm : undefined
const identityBytes = credentialToMLSIdentity(credential, { longForm })
```

Add `isPeer4, type MultiKeyIdentity` to the token import. (Concrete call sites: search for `credentialToMLSIdentity(` in `group.ts`. Pass `{ longForm }` at each.)

- [ ] **Step 5: Pass cache to capability checks done by group code**

Find every `checkCapability` / `checkDelegationChain` call inside `group.ts`. Update the options arg to include `cache: this.#cache`. If no cache is in scope (e.g. utility functions outside the class), accept a `cache` parameter and forward.

- [ ] **Step 6: Default cache when creating a group**

Find `createGroup` (and any other group-handle factory). Where the handle is constructed:

```ts
const cache = options?.cache ?? createInMemoryDIDCache()
// ... existing setup
return new GroupHandle({ state, credential, context, rootCapability, cache })
```

Same in `joinGroup`, `joinGroupExternal`.

- [ ] **Step 7: Build**

Run: `pnpm --filter @enkaku/group build`
Expected: clean.

- [ ] **Step 8: Run existing group tests**

Run: `pnpm --filter @enkaku/group test`
Expected: all existing tests pass (did:key path unchanged).

- [ ] **Step 9: Commit**

```bash
git add packages/group/src/types.ts packages/group/src/group.ts packages/group/src/credential.ts
git commit -m "feat(group): GroupHandle owns DIDCache, populates from credentials on member events"
```

---

### Task 4.3: Two-member peer4 group integration test

**Files:**
- Create: `packages/group/test/peer4-credential.test.ts`

- [ ] **Step 1: Inspect existing group test for setup pattern**

Run: `head -100 packages/group/test/group.test.ts`

Note the imports, ciphersuite setup, identity construction, and how members create/join groups.

- [ ] **Step 2: Write the integration test**

Create `packages/group/test/peer4-credential.test.ts`. Use the harness pattern from `group.test.ts` (read it first). Skeleton:

```ts
import { describe, expect, it } from 'vitest'
import {
  createIdentity,
  createInMemoryDIDCache,
  encodePeer4,
} from '@enkaku/token'

// Import createGroup / joinGroup / etc. from ../src/group.js — match group.test.ts imports.

describe('Gate 4 — peer4 group credentials', () => {
  it('two peer4 members: cache populates from credential, short-form app messages verify', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })

    // 1. Alice creates a group, providing her cache.
    // 2. Alice generates an invite for Bob using Bob's key package (which carries Bob's longForm).
    // 3. Bob joins the group with his own cache.
    // 4. Alice processes Bob's join commit; her cache now holds bob_short -> bob_doc.
    // 5. Bob's cache holds alice_short -> alice_doc via the Welcome group state.
    // 6. Bob sends an application message signed with iss = bob_short.
    // 7. Alice processes the message; verifies via her group cache; succeeds.

    expect(alice.did).toBeDefined()
    expect(bob.did).toBeDefined()
    // Fill in with the harness from group.test.ts.
  })

  it('mixed group: peer4 + did:key members interoperate', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const charlie = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'key',
    })
    // Build a 2-member group with alice (peer4) and charlie (did:key).
    // Assert credentials for alice carry longForm, credentials for charlie do not.
    // Assert app messages from both verify correctly.
    expect(alice.did).toBeDefined()
    expect(charlie.did).toBeDefined()
  })

  it('rejects credential whose longForm hash does not match did', async () => {
    const alice = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    const bob = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA' }],
      didMethod: 'peer:4',
    })
    // Construct a SerializedCredential with did = alice.did but longForm = bob.longForm.
    // Pass to populateCacheFromCredential.
    // Expect rejection (hash mismatch).
    const cache = createInMemoryDIDCache()
    const { populateCacheFromCredential } = await import('../src/credential.js')
    await expect(
      populateCacheFromCredential(
        {
          did: alice.did,
          groupID: 'g',
          capabilityChain: [],
          longForm: bob.longForm,
        },
        cache,
      ),
    ).rejects.toThrow(/does not match/i)
  })
})
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @enkaku/group test test/peer4-credential.test.ts`
Expected: PASS after harness adaptation.

If the integration test cannot drive Welcome/Commit through the existing harness, study `group.test.ts` and `external-rejoin.test.ts` for the helpers used. Do not invent new MLS plumbing.

- [ ] **Step 4: Run full group suite**

Run: `pnpm --filter @enkaku/group test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/group/test/peer4-credential.test.ts
git commit -m "test(group): Gate 4 two-member peer4 credential exchange and cache population"
```

---

### Gate 4 verification

- [ ] **Step 1: Workspace build + lint + tests**

Run: `pnpm run build && pnpm run lint && pnpm run test`
Expected: clean.

- [ ] **Step 2: Update plan stage**

Edit plan: `**Stage:** reviewing`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-26-did-peer-4-transport-integration.md
git commit -m "chore: peer4 integration plan complete, ready for review"
```

---

## Final verification

- [ ] **Step 1: Full workspace check**

```bash
pnpm run build && pnpm run lint && pnpm run test
```

- [ ] **Step 2: Re-read the spec checklist**

Open `docs/superpowers/specs/2026-05-26-did-peer-4-transport-integration-design.md`. Verify every section under "Architecture" and "Data flow" has a corresponding implementation task in this plan. Make a note of any gaps.

- [ ] **Step 3: Run all new peer4-related tests in isolation as a sanity check**

```bash
pnpm --filter @enkaku/token test test/normalize-did.test.ts test/cache.test.ts test/resolve-issuer.test.ts test/token.test.ts test/identity.test.ts
pnpm --filter @enkaku/capability test test/delegation-peer4.test.ts
pnpm --filter @enkaku/server test test/peer4-handshake.test.ts
pnpm --filter @enkaku/group test test/peer4-credential.test.ts
```

All green.

- [ ] **Step 4: Hand off for review**

Plan stage now `reviewing`. Hand off to code review per the dev-loop flow (`superpowers:requesting-code-review`).
