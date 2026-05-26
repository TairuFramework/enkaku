# did:peer:4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `did:peer:4` support to the `@enkaku/token` package alongside the existing `did:key` method, enabling compact identifiers for multi-key and future post-quantum identities.

**Architecture:** Introduce multibase/multihash primitives and `did:peer:4` long/short form encoders inside the token package. Refactor token verification to dispatch by DID method, looking up `did:peer:4` short-form identifiers through a content-addressed cache. Add a unified `createIdentity` builder that picks the DID method automatically based on the key set. Provide a rotation assertion helper for migrating between DIDs.

**Tech Stack:** TypeScript, vitest, `@noble/hashes` (SHA-256), `@scure/base` (base58btc, already a dep), `@enkaku/codec` (canonical JSON via existing `canonicalStringify`), `@enkaku/schema` (AJV validators).

**Scope note:** Transport-layer integration (HTTP/WebSocket handshake header in `@enkaku/server`, MLS `LeafNode` credential carrying long form in `@enkaku/group`) is deferred to a follow-up plan. This plan lands the token-package foundation: contracts (`DIDResolver`, `DIDCache`), verification dispatch, identity builder, rotation. Once shipped, downstream packages can adopt without further token-side changes.

---

## File Structure

**New files in `packages/token/src/`:**

- `multibase.ts` — `encodeMultibase`, `decodeMultibase`, `multihashSHA256`, `verifyMultihash`. Pure byte/string helpers; depends only on `@scure/base` and `@noble/hashes`.
- `peer4.ts` — `encodePeer4LongForm`, `decodePeer4`, `getPeer4ShortForm`, `getPeer4LongForm`, `DIDDoc` type, `validateDIDDoc`. Imports multibase helpers and `canonicalStringify` from `@enkaku/codec`.
- `cache.ts` — `DIDResolver`, `DIDCache` types, `createInMemoryDIDCache()` factory.
- `rotation.ts` — `RotationAssertion` type, `createRotationAssertion` helper.

**Modified files in `packages/token/src/`:**

- `did.ts` — keep existing `did:key` logic; add `resolveIssuer(iss, header, resolver?)` that dispatches by DID method prefix.
- `schemas.ts` — extend `signedHeaderSchema` with optional `kid` field.
- `token.ts` — `verifySignedPayload` and `verifyToken` accept an optional `resolver: DIDResolver` argument; route to `resolveIssuer`.
- `identity.ts` — add `KeyAlg`, `KeyPurpose`, `IdentityKeySpec`, `CreateIdentityInput`, `MultiKeyIdentity` types and `createIdentity` builder. Existing exports unchanged.
- `index.ts` — export new symbols.

**New test files in `packages/token/test/`:**

- `multibase.test.ts`
- `peer4.test.ts`
- `cache.test.ts`
- `identity-create.test.ts`
- `rotation.test.ts`
- `token-peer4.test.ts`

---

## Task 1: Multibase + multihash helpers

**Files:**
- Create: `packages/token/src/multibase.ts`
- Test: `packages/token/test/multibase.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/token/test/multibase.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  decodeMultibase,
  encodeMultibase,
  multihashSHA256,
  verifyMultihash,
} from '../src/multibase.js'

describe('multibase', () => {
  it('round-trips bytes through base58btc multibase', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const encoded = encodeMultibase(bytes)
    expect(encoded.startsWith('z')).toBe(true)
    expect(decodeMultibase(encoded)).toEqual(bytes)
  })

  it('rejects non-z prefixes', () => {
    expect(() => decodeMultibase('mAAAA')).toThrow(/Unsupported multibase prefix/)
  })

  it('rejects empty string', () => {
    expect(() => decodeMultibase('')).toThrow(/Invalid multibase encoding/)
  })
})

describe('multihash SHA-256', () => {
  it('produces 0x12 0x20 prefix + 32-byte digest', () => {
    const mh = multihashSHA256(new Uint8Array([1, 2, 3]))
    expect(mh.length).toBe(34)
    expect(mh[0]).toBe(0x12)
    expect(mh[1]).toBe(0x20)
  })

  it('verifies a valid multihash against original bytes', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(bytes)
    expect(verifyMultihash(mh, bytes)).toBe(true)
  })

  it('rejects a multihash that does not match the bytes', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(new TextEncoder().encode('world'))
    expect(verifyMultihash(mh, bytes)).toBe(false)
  })

  it('rejects a multihash with wrong function code', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(bytes)
    mh[0] = 0x13
    expect(verifyMultihash(mh, bytes)).toBe(false)
  })

  it('rejects a multihash with wrong length byte', () => {
    const bytes = new TextEncoder().encode('hello')
    const mh = multihashSHA256(bytes)
    mh[1] = 0x10
    expect(verifyMultihash(mh, bytes)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/multibase.test.ts`
Expected: FAIL — module `../src/multibase.js` not found.

- [ ] **Step 3: Implement multibase + multihash**

`packages/token/src/multibase.ts`:

```ts
import { sha256 } from '@noble/hashes/sha2.js'
import { base58 } from '@scure/base'

const MULTIBASE_BASE58BTC = 'z'
const MULTIHASH_SHA256_CODE = 0x12
const MULTIHASH_SHA256_LENGTH = 0x20

/**
 * Encode bytes as base58btc multibase string (prefix `z`).
 */
export function encodeMultibase(bytes: Uint8Array): string {
  return MULTIBASE_BASE58BTC + base58.encode(bytes)
}

/**
 * Decode a base58btc multibase string back to bytes.
 * Throws on unsupported prefixes or empty input.
 */
export function decodeMultibase(value: string): Uint8Array {
  if (value.length === 0) {
    throw new Error('Invalid multibase encoding: empty string')
  }
  const prefix = value[0]
  if (prefix !== MULTIBASE_BASE58BTC) {
    throw new Error(`Unsupported multibase prefix: ${prefix}`)
  }
  return base58.decode(value.slice(1))
}

/**
 * Build a sha2-256 multihash: 0x12 0x20 then 32-byte SHA-256 digest.
 */
export function multihashSHA256(bytes: Uint8Array): Uint8Array {
  const digest = sha256(bytes)
  const out = new Uint8Array(2 + digest.length)
  out[0] = MULTIHASH_SHA256_CODE
  out[1] = MULTIHASH_SHA256_LENGTH
  out.set(digest, 2)
  return out
}

/**
 * Verify that a multihash matches the SHA-256 digest of the given bytes.
 * Returns false on length, prefix, or digest mismatch.
 */
export function verifyMultihash(multihash: Uint8Array, bytes: Uint8Array): boolean {
  if (multihash.length !== 2 + MULTIHASH_SHA256_LENGTH) return false
  if (multihash[0] !== MULTIHASH_SHA256_CODE) return false
  if (multihash[1] !== MULTIHASH_SHA256_LENGTH) return false
  const expected = sha256(bytes)
  for (let i = 0; i < MULTIHASH_SHA256_LENGTH; i++) {
    if (multihash[2 + i] !== expected[i]) return false
  }
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/multibase.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/multibase.ts packages/token/test/multibase.test.ts
git commit -m "feat(token): add multibase and multihash helpers"
```

---

## Task 2: DID document type and validator

**Files:**
- Create: `packages/token/src/peer4.ts` (initial — just types and validator)
- Test: `packages/token/test/peer4.test.ts` (initial — just validator tests)

- [ ] **Step 1: Write the failing tests**

`packages/token/test/peer4.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateDIDDoc } from '../src/peer4.js'

describe('validateDIDDoc', () => {
  it('accepts a minimal valid doc', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [
          { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' },
        ],
        authentication: ['#key-0'],
      }),
    ).toBe(true)
  })

  it('rejects a doc missing verificationMethod', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
      }),
    ).toBe(false)
  })

  it('rejects a verificationMethod entry missing publicKeyMultibase', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [{ id: '#key-0', type: 'Multikey' }],
      }),
    ).toBe(false)
  })

  it('accepts a doc with keyAgreement entries', () => {
    expect(
      validateDIDDoc({
        '@context': ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [
          { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' },
          { id: '#key-1', type: 'Multikey', publicKeyMultibase: 'z6LSdef' },
        ],
        authentication: ['#key-0'],
        keyAgreement: ['#key-1'],
      }),
    ).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/peer4.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement DIDDoc type + validator**

`packages/token/src/peer4.ts`:

```ts
import { createValidator, type FromSchema, type Schema } from '@enkaku/schema'

/** @internal */
export const verificationMethodSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    publicKeyMultibase: { type: 'string' },
  },
  required: ['id', 'type', 'publicKeyMultibase'],
  additionalProperties: true,
} as const satisfies Schema
/** @internal */
export type VerificationMethod = FromSchema<typeof verificationMethodSchema>

/** @internal */
export const didDocSchema = {
  type: 'object',
  properties: {
    '@context': {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
    verificationMethod: {
      type: 'array',
      items: verificationMethodSchema,
      minItems: 1,
    },
    authentication: { type: 'array', items: { type: 'string' } },
    keyAgreement: { type: 'array', items: { type: 'string' } },
    assertionMethod: { type: 'array', items: { type: 'string' } },
  },
  required: ['verificationMethod'],
  additionalProperties: true,
} as const satisfies Schema
/** @internal */
export type DIDDoc = FromSchema<typeof didDocSchema>

const didDocValidator = createValidator(didDocSchema)

/**
 * Validate that an unknown value conforms to the DID document schema used inside did:peer:4.
 */
export function validateDIDDoc(value: unknown): value is DIDDoc {
  return didDocValidator(value) as boolean
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/peer4.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/peer4.ts packages/token/test/peer4.test.ts
git commit -m "feat(token): add DID document schema and validator"
```

---

## Task 3: did:peer:4 long-form encode

**Files:**
- Modify: `packages/token/src/peer4.ts`
- Test: `packages/token/test/peer4.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/token/test/peer4.test.ts`:

```ts
import { encodePeer4 } from '../src/peer4.js'

describe('encodePeer4', () => {
  const doc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod: [
      { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' },
    ],
    authentication: ['#key-0'],
  }

  it('produces a long form starting with did:peer:4', () => {
    const { longForm } = encodePeer4(doc)
    expect(longForm.startsWith('did:peer:4z')).toBe(true)
  })

  it('produces a short form prefix that matches the long form', () => {
    const { longForm, shortForm } = encodePeer4(doc)
    expect(longForm.startsWith(`${shortForm}:`)).toBe(true)
  })

  it('is deterministic — same doc → same long form', () => {
    const a = encodePeer4(doc)
    const b = encodePeer4({ ...doc })
    expect(a.longForm).toBe(b.longForm)
  })

  it('produces different output for different docs', () => {
    const a = encodePeer4(doc)
    const b = encodePeer4({ ...doc, authentication: [] })
    expect(a.longForm).not.toBe(b.longForm)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/peer4.test.ts`
Expected: FAIL — `encodePeer4` is not exported.

- [ ] **Step 3: Implement encodePeer4**

Append to `packages/token/src/peer4.ts`:

```ts
import { canonicalStringify, fromUTF } from '@enkaku/codec'

import { encodeMultibase, multihashSHA256 } from './multibase.js'

const PEER4_PREFIX = 'did:peer:4'
const JSON_MULTICODEC = new Uint8Array([0x80, 0x04])

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/**
 * Encode a DID document as a did:peer:4 identifier.
 * Returns both the long form (self-contained, doc embedded) and short form (hash only).
 */
export function encodePeer4(doc: DIDDoc): { longForm: string; shortForm: string; doc: DIDDoc } {
  const canonicalDocBytes = fromUTF(canonicalStringify(doc))
  const taggedDoc = concatBytes(JSON_MULTICODEC, canonicalDocBytes)
  const encodedDoc = encodeMultibase(taggedDoc)
  const hashBytes = multihashSHA256(fromUTF(encodedDoc))
  const hash = encodeMultibase(hashBytes)
  const shortForm = `${PEER4_PREFIX}${hash}`
  const longForm = `${shortForm}:${encodedDoc}`
  return { longForm, shortForm, doc }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/peer4.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/peer4.ts packages/token/test/peer4.test.ts
git commit -m "feat(token): encode did:peer:4 long and short forms"
```

---

## Task 4: did:peer:4 decode + hash verification

**Files:**
- Modify: `packages/token/src/peer4.ts`
- Test: `packages/token/test/peer4.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/token/test/peer4.test.ts`:

```ts
import { decodePeer4, getPeer4ShortForm, isPeer4 } from '../src/peer4.js'

describe('decodePeer4', () => {
  const doc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod: [
      { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' },
    ],
    authentication: ['#key-0'],
  }

  it('decodes a long form back to the original doc', () => {
    const { longForm } = encodePeer4(doc)
    const decoded = decodePeer4(longForm)
    expect(decoded.doc).toEqual(doc)
    expect(decoded.shortForm).toBe(longForm.split(':').slice(0, 3).join(':'))
  })

  it('rejects a long form with mismatched hash', () => {
    const { longForm } = encodePeer4(doc)
    const idx = longForm.indexOf(':z', 'did:peer:4'.length) + 2
    const tampered = `${longForm.slice(0, idx)}A${longForm.slice(idx + 1)}`
    expect(() => decodePeer4(tampered)).toThrow(/hash mismatch/i)
  })

  it('rejects a short form passed to decodePeer4', () => {
    const { shortForm } = encodePeer4(doc)
    expect(() => decodePeer4(shortForm)).toThrow(/long form/i)
  })

  it('rejects a non-peer:4 DID', () => {
    expect(() => decodePeer4('did:key:z6MkAbc')).toThrow(/Invalid did:peer:4/)
  })

  it('rejects an oversized doc', () => {
    const big = { ...doc, padding: 'x'.repeat(70 * 1024) }
    const { longForm } = encodePeer4(big)
    expect(() => decodePeer4(longForm, { maxDocSize: 64 * 1024 })).toThrow(/doc too large/i)
  })
})

describe('isPeer4 / getPeer4ShortForm', () => {
  it('detects peer:4 DIDs', () => {
    expect(isPeer4('did:peer:4zAbc')).toBe(true)
    expect(isPeer4('did:key:z6Mk')).toBe(false)
  })

  it('extracts the short form from a long form', () => {
    const { longForm, shortForm } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [{ id: '#k', type: 'Multikey', publicKeyMultibase: 'z6Mk' }],
    })
    expect(getPeer4ShortForm(longForm)).toBe(shortForm)
    expect(getPeer4ShortForm(shortForm)).toBe(shortForm)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/peer4.test.ts`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement decodePeer4 + helpers**

Append to `packages/token/src/peer4.ts`:

```ts
import { toUTF } from '@enkaku/codec'

import { decodeMultibase, verifyMultihash } from './multibase.js'

const DEFAULT_MAX_DOC_SIZE = 64 * 1024

export type DecodePeer4Options = {
  /** Maximum allowed size of the canonical doc bytes. Default 64 KB. */
  maxDocSize?: number
}

/**
 * Check whether a value is a did:peer:4 identifier (either form).
 */
export function isPeer4(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PEER4_PREFIX)
}

/**
 * Extract the short form from either a short or long did:peer:4 string.
 */
export function getPeer4ShortForm(did: string): string {
  if (!isPeer4(did)) {
    throw new Error('Invalid did:peer:4 identifier')
  }
  const sep = did.indexOf(':', PEER4_PREFIX.length)
  return sep === -1 ? did : did.slice(0, sep)
}

function startsWithJsonCodec(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === JSON_MULTICODEC[0] && bytes[1] === JSON_MULTICODEC[1]
}

/**
 * Decode a did:peer:4 long form into its DID document.
 * Verifies the embedded hash against the encoded doc; throws on mismatch.
 */
export function decodePeer4(
  longForm: string,
  options: DecodePeer4Options = {},
): { longForm: string; shortForm: string; doc: DIDDoc } {
  if (!isPeer4(longForm)) {
    throw new Error('Invalid did:peer:4 identifier')
  }
  const sep = longForm.indexOf(':', PEER4_PREFIX.length)
  if (sep === -1) {
    throw new Error('Expected did:peer:4 long form, got short form')
  }
  const hashEncoded = longForm.slice(PEER4_PREFIX.length, sep)
  const encodedDoc = longForm.slice(sep + 1)

  const hashBytes = decodeMultibase(hashEncoded)
  if (!verifyMultihash(hashBytes, fromUTF(encodedDoc))) {
    throw new Error('did:peer:4 hash mismatch')
  }

  const taggedDoc = decodeMultibase(encodedDoc)
  if (!startsWithJsonCodec(taggedDoc)) {
    throw new Error('did:peer:4 doc missing JSON multicodec prefix')
  }
  const docBytes = taggedDoc.slice(JSON_MULTICODEC.length)
  const maxSize = options.maxDocSize ?? DEFAULT_MAX_DOC_SIZE
  if (docBytes.length > maxSize) {
    throw new Error(`did:peer:4 doc too large: ${docBytes.length} > ${maxSize}`)
  }

  const doc = JSON.parse(toUTF(docBytes)) as unknown
  if (!validateDIDDoc(doc)) {
    throw new Error('did:peer:4 doc failed schema validation')
  }

  const shortForm = `${PEER4_PREFIX}${hashEncoded}`
  return { longForm, shortForm, doc }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/peer4.test.ts`
Expected: PASS (15 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/peer4.ts packages/token/test/peer4.test.ts
git commit -m "feat(token): decode and verify did:peer:4 long form"
```

---

## Task 5: DID resolver and cache contracts

**Files:**
- Create: `packages/token/src/cache.ts`
- Test: `packages/token/test/cache.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/token/test/cache.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createInMemoryDIDCache } from '../src/cache.js'
import { encodePeer4 } from '../src/peer4.js'

const docA = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [
    { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkAbc' },
  ],
  authentication: ['#key-0'],
}

const docB = {
  '@context': ['https://www.w3.org/ns/did/v1'],
  verificationMethod: [
    { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6MkDef' },
  ],
  authentication: ['#key-0'],
}

describe('createInMemoryDIDCache', () => {
  it('stores and retrieves a doc by short form', async () => {
    const cache = createInMemoryDIDCache()
    const { shortForm, doc } = encodePeer4(docA)
    await cache.set(shortForm, doc)
    expect(await cache.get(shortForm)).toEqual(doc)
  })

  it('returns undefined for unknown short form', async () => {
    const cache = createInMemoryDIDCache()
    expect(await cache.get('did:peer:4zUnknown')).toBeUndefined()
  })

  it('rejects set when short form does not match the doc hash', async () => {
    const cache = createInMemoryDIDCache()
    const { shortForm: shortA } = encodePeer4(docA)
    await expect(cache.set(shortA, docB)).rejects.toThrow(/hash mismatch/i)
  })

  it('rejects set for non-peer:4 short form', async () => {
    const cache = createInMemoryDIDCache()
    await expect(cache.set('did:key:z6Mk', docA)).rejects.toThrow(/did:peer:4/)
  })

  it('is idempotent — repeated set with same doc is fine', async () => {
    const cache = createInMemoryDIDCache()
    const { shortForm } = encodePeer4(docA)
    await cache.set(shortForm, docA)
    await cache.set(shortForm, docA)
    expect(await cache.get(shortForm)).toEqual(docA)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cache**

`packages/token/src/cache.ts`:

```ts
import { type DIDDoc, encodePeer4, isPeer4 } from './peer4.js'

/**
 * Resolves a DID string to a DID document.
 * Implementations may be sync or async, returning undefined when the DID is unknown.
 */
export type DIDResolver = (did: string) => DIDDoc | undefined | Promise<DIDDoc | undefined>

/**
 * Content-addressed store for did:peer:4 documents, keyed by the short-form DID.
 * `set` MUST verify that the short form matches the hash of the canonical doc before storing.
 */
export type DIDCache = {
  get(shortForm: string): DIDDoc | undefined | Promise<DIDDoc | undefined>
  set(shortForm: string, doc: DIDDoc): void | Promise<void>
}

/**
 * Build an in-memory DID cache. The returned cache verifies short-form/doc binding on every set.
 */
export function createInMemoryDIDCache(): DIDCache {
  const docs = new Map<string, DIDDoc>()
  return {
    get(shortForm) {
      return docs.get(shortForm)
    },
    set(shortForm, doc) {
      if (!isPeer4(shortForm)) {
        throw new Error('DIDCache: short form must be a did:peer:4 identifier')
      }
      const expected = encodePeer4(doc).shortForm
      if (expected !== shortForm) {
        throw new Error('DIDCache: short form/doc hash mismatch')
      }
      docs.set(shortForm, doc)
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/cache.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/cache.ts packages/token/test/cache.test.ts
git commit -m "feat(token): add DID resolver and in-memory cache"
```

---

## Task 6: Add `kid` to signed header schema

**Files:**
- Modify: `packages/token/src/schemas.ts`
- Test: `packages/token/test/schemas-kid.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/token/test/schemas-kid.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateSignedHeader } from '../src/schemas.js'

describe('signedHeaderSchema kid', () => {
  it('accepts a header with kid', () => {
    expect(
      validateSignedHeader({ typ: 'JWT', alg: 'EdDSA', kid: '#key-0' }),
    ).toBe(true)
  })

  it('accepts a header without kid', () => {
    expect(validateSignedHeader({ typ: 'JWT', alg: 'EdDSA' })).toBe(true)
  })

  it('rejects a header with non-string kid', () => {
    expect(validateSignedHeader({ typ: 'JWT', alg: 'EdDSA', kid: 42 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/token && pnpm exec vitest run test/schemas-kid.test.ts`
Expected: FAIL — the third test passes (kid is currently `additionalProperties: true`); the type check on kid is missing.

- [ ] **Step 3: Extend `signedHeaderSchema`**

In `packages/token/src/schemas.ts`, replace the `signedHeaderSchema` definition:

```ts
/** @internal */
export const signedHeaderSchema = {
  type: 'object',
  properties: {
    typ: { type: 'string', const: 'JWT' },
    alg: signatureAlgorithmSchema,
    kid: { type: 'string' },
  },
  required: ['typ', 'alg'],
  additionalProperties: true,
} as const satisfies Schema
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/schemas-kid.test.ts`
Expected: PASS (3 tests).

Run the full token test suite to confirm nothing regressed:

```bash
cd packages/token && pnpm test:unit
```

Expected: all existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/schemas.ts packages/token/test/schemas-kid.test.ts
git commit -m "feat(token): allow optional kid in signed header"
```

---

## Task 7: resolveIssuer dispatch in did.ts

**Files:**
- Modify: `packages/token/src/did.ts`
- Test: `packages/token/test/resolve-issuer.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/token/test/resolve-issuer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519.js'

import { CODECS, getDID, resolveIssuer } from '../src/did.js'
import { createInMemoryDIDCache } from '../src/cache.js'
import { encodePeer4 } from '../src/peer4.js'
import { encodeMultibase } from '../src/multibase.js'

describe('resolveIssuer', () => {
  it('resolves a did:key issuer to alg + pubkey without a resolver', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const pub = ed25519.getPublicKey(priv)
    const did = getDID(CODECS.EdDSA, pub)
    const [alg, key] = await resolveIssuer(did)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('resolves a did:peer:4 short-form issuer via cache + kid', async () => {
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
    const cache = createInMemoryDIDCache()
    await cache.set(shortForm, doc)
    const resolver = (did: string) => cache.get(did)
    const [alg, key] = await resolveIssuer(shortForm, { kid: '#key-0' }, resolver)
    expect(alg).toBe('EdDSA')
    expect(key).toEqual(pub)
  })

  it('throws UnknownDID when peer:4 short form is unresolvable', async () => {
    await expect(
      resolveIssuer('did:peer:4zAAAAA', { kid: '#key-0' }, () => undefined),
    ).rejects.toThrow(/Unknown DID/)
  })

  it('throws when kid is missing for peer:4', async () => {
    const { shortForm, doc } = encodePeer4({
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [
        { id: '#key-0', type: 'Multikey', publicKeyMultibase: 'z6Mk' },
      ],
      authentication: ['#key-0'],
    })
    const resolver = (did: string) => (did === shortForm ? doc : undefined)
    await expect(resolveIssuer(shortForm, {}, resolver)).rejects.toThrow(/kid/i)
  })

  it('throws KidNotFound when kid does not exist in doc', async () => {
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
    await expect(
      resolveIssuer(shortForm, { kid: '#missing' }, resolver),
    ).rejects.toThrow(/KidNotFound/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/resolve-issuer.test.ts`
Expected: FAIL — `resolveIssuer` not exported.

- [ ] **Step 3: Implement `resolveIssuer`**

Append to `packages/token/src/did.ts`:

```ts
import type { DIDResolver } from './cache.js'
import type { DIDDoc, VerificationMethod } from './peer4.js'
import { getPeer4ShortForm, isPeer4 } from './peer4.js'
import { decodeMultibase } from './multibase.js'

export type ResolveIssuerHeader = { kid?: string }

/**
 * Resolve a token issuer (did:key or did:peer:4) to [alg, publicKey].
 * For did:peer:4 issuers, the resolver MUST be provided.
 */
export async function resolveIssuer(
  iss: string,
  header: ResolveIssuerHeader = {},
  resolver?: DIDResolver,
): Promise<[SignatureAlgorithm, Uint8Array]> {
  if (isPeer4(iss)) {
    if (resolver == null) {
      throw new Error('resolveIssuer: did:peer:4 requires a resolver')
    }
    const shortForm = getPeer4ShortForm(iss)
    const doc = await resolver(shortForm)
    if (doc == null) {
      throw new Error(`Unknown DID: ${shortForm}`)
    }
    if (header.kid == null) {
      throw new Error('resolveIssuer: did:peer:4 token missing kid header')
    }
    return resolveKidFromDoc(doc, header.kid)
  }

  // did:key path
  return getSignatureInfo(iss)
}

function resolveKidFromDoc(doc: DIDDoc, kid: string): [SignatureAlgorithm, Uint8Array] {
  const method = (doc.verificationMethod as Array<VerificationMethod>).find((m) => m.id === kid)
  if (method == null) {
    throw new Error(`KidNotFound: ${kid}`)
  }
  const bytes = decodeMultibase(method.publicKeyMultibase)
  const info = getAlgorithmAndPublicKey(bytes)
  if (info == null) {
    throw new Error('Unsupported verification method codec')
  }
  return info
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/resolve-issuer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/did.ts packages/token/test/resolve-issuer.test.ts
git commit -m "feat(token): add resolveIssuer dispatching by DID method"
```

---

## Task 8: Thread resolver through verifySignedPayload + verifyToken

**Files:**
- Modify: `packages/token/src/token.ts`
- Test: `packages/token/test/token-peer4.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/token/test/token-peer4.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'

import { createInMemoryDIDCache } from '../src/cache.js'
import { encodeMultibase } from '../src/multibase.js'
import { encodePeer4 } from '../src/peer4.js'
import { verifyToken } from '../src/token.js'

function buildPeer4Token(privateKey: Uint8Array) {
  const pub = ed25519.getPublicKey(privateKey)
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
  const header = { typ: 'JWT' as const, alg: 'EdDSA' as const, kid: '#key-0' }
  const payload = { iss: shortForm }
  const data = `${b64uFromJSON(header)}.${b64uFromJSON(payload)}`
  const signature = toB64U(ed25519.sign(fromUTF(data), privateKey))
  return { token: { header, payload, signature, data }, shortForm, doc }
}

describe('verifyToken with did:peer:4', () => {
  it('verifies a peer:4 token when the doc is cached', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const { token, shortForm, doc } = buildPeer4Token(priv)
    const cache = createInMemoryDIDCache()
    await cache.set(shortForm, doc)
    const verified = await verifyToken(token, undefined, undefined, {
      resolver: (did) => cache.get(did),
    })
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey).toEqual(
      ed25519.getPublicKey(priv),
    )
  })

  it('throws UnknownDID when peer:4 doc is not cached', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const { token } = buildPeer4Token(priv)
    await expect(
      verifyToken(token, undefined, undefined, { resolver: () => undefined }),
    ).rejects.toThrow(/Unknown DID/)
  })

  it('still verifies a did:key token without a resolver', async () => {
    const { createSigningIdentity } = await import('../src/identity.js')
    const priv = ed25519.utils.randomSecretKey()
    const id = createSigningIdentity(priv)
    const signed = await id.signToken({ iss: id.id })
    const verified = await verifyToken(signed)
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey).toEqual(id.publicKey)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/token-peer4.test.ts`
Expected: FAIL — `verifyToken` does not accept the resolver options.

- [ ] **Step 3: Update `verifySignedPayload` and `verifyToken`**

In `packages/token/src/token.ts`:

Replace the existing imports + `verifySignedPayload` signature + `verifyTokenInner` + `verifyToken` with the resolver-aware versions:

```ts
import { b64uToJSON, fromB64U, fromUTF } from '@enkaku/codec'
import { AttributeKeys, createTracer, SpanNames, withSpan } from '@enkaku/otel'
import { assertType, isType } from '@enkaku/schema'

import type { DIDResolver } from './cache.js'
import { resolveIssuer } from './did.js'
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

const tokenTracer = createTracer('token')

export type VerifyTokenOptions = {
  resolver?: DIDResolver
}

/**
 * Verify the signature of a signed payload and return the public key of the issuer.
 */
export async function verifySignedPayload<
  Payload extends Record<string, unknown> = Record<string, unknown>,
>(
  signature: Uint8Array,
  payload: Payload,
  header: { alg?: string; kid?: string },
  data: Uint8Array | string,
  verifiers?: Verifiers,
  resolver?: DIDResolver,
): Promise<Uint8Array> {
  assertType(validateSignedPayload, payload)
  const [alg, publicKey] = await resolveIssuer(payload.iss, { kid: header.kid }, resolver)
  const verify = getVerifier(alg, verifiers)
  const message = typeof data === 'string' ? fromUTF(data) : data
  const verified = await verify(signature, message, publicKey)
  if (!verified) {
    throw new Error('Invalid signature')
  }
  return publicKey
}
```

Update `verifyTokenInner` to receive and forward the resolver:

```ts
async function verifyTokenInner<Payload extends Record<string, unknown> = Record<string, unknown>>(
  token: Token<Payload> | string,
  verifiers?: Verifiers,
  timeOptions?: TimeValidationOptions,
  options?: VerifyTokenOptions,
): Promise<Token<Payload>> {
  if (typeof token !== 'string') {
    if (isUnsignedToken(token)) {
      return token
    }
    if (isVerifiedToken(token)) {
      assertTimeClaimsValid(token.payload as Record<string, unknown>, timeOptions)
      return token
    }
    if (isSignedToken(token)) {
      const verifiedPublicKey = await verifySignedPayload(
        fromB64U(token.signature),
        token.payload,
        token.header as { alg?: string; kid?: string },
        token.data,
        verifiers,
        options?.resolver,
      )
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
    throw new Error('Invalid token header type')
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
      header as { alg?: string; kid?: string },
      data,
      verifiers,
      options?.resolver,
    )
    assertTimeClaimsValid(payload as Record<string, unknown>, timeOptions)
    return {
      data,
      header,
      payload,
      signature,
      verifiedPublicKey,
    } as Token<Payload>
  }

  throw new Error('Unsupported signature algorithm')
}

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
  options?: VerifyTokenOptions,
): Promise<Token<Payload>> {
  return withSpan(tokenTracer, SpanNames.TOKEN_VERIFY, {}, async (span) => {
    const result = await verifyTokenInner(token, verifiers, timeOptions, options)
    if (isSignedToken(result)) {
      span.setAttribute(
        AttributeKeys.AUTH_DID,
        (result.payload as Record<string, unknown>).iss as string,
      )
      span.setAttribute(AttributeKeys.AUTH_ALGORITHM, result.header.alg)
    }
    return result
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/token-peer4.test.ts`
Expected: PASS (3 tests).

Also run the full token test suite to verify nothing regressed:

```bash
cd packages/token && pnpm test:unit
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/token.ts packages/token/test/token-peer4.test.ts
git commit -m "feat(token): support did:peer:4 verification via resolver"
```

---

## Task 9: Unified createIdentity builder

**Files:**
- Modify: `packages/token/src/identity.ts`
- Test: `packages/token/test/identity-create.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/token/test/identity-create.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ed25519, x25519 } from '@noble/curves/ed25519.js'

import { createIdentity } from '../src/identity.js'
import { decodePeer4, isPeer4 } from '../src/peer4.js'
import { verifyToken } from '../src/token.js'
import { createInMemoryDIDCache } from '../src/cache.js'

describe('createIdentity', () => {
  it('emits did:key for a single classical signing key', async () => {
    const identity = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    expect(identity.did.startsWith('did:key:')).toBe(true)
    expect(identity.longForm).toBe(identity.did)
  })

  it('emits did:peer:4 for multi-key identities', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    expect(isPeer4(identity.did)).toBe(true)
    expect(identity.longForm).not.toBe(identity.did)
    expect(identity.doc.verificationMethod.length).toBe(2)
  })

  it('rejects didMethod: "key" with multi-key input', async () => {
    await expect(
      createIdentity({
        keys: [
          { purpose: 'sig', alg: 'EdDSA' },
          { purpose: 'kem', alg: 'X25519' },
        ],
        didMethod: 'key',
      }),
    ).rejects.toThrow(/InvalidMethod/)
  })

  it('signs and verifies a token using a peer:4 multi-key identity', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'sig', alg: 'EdDSA' },
      ],
    })
    const cache = createInMemoryDIDCache()
    await cache.set(identity.did, identity.doc)
    const signed = await identity.sign({ aud: 'someone' })
    expect(signed.header.kid).toBeDefined()
    expect(signed.payload.iss).toBe(identity.did)
    const verified = await verifyToken(signed, undefined, undefined, {
      resolver: (did) => cache.get(did),
    })
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey.length).toBe(32)
  })

  it('allows explicit kid selection', async () => {
    const identity = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'sig', alg: 'EdDSA' },
      ],
    })
    const signed = await identity.sign({ aud: 'a' }, { kid: '#key-1' })
    expect(signed.header.kid).toBe('#key-1')
  })

  it('accepts caller-provided private keys', async () => {
    const priv = ed25519.utils.randomSecretKey()
    const identity = await createIdentity({
      keys: [{ purpose: 'sig', alg: 'EdDSA', privateKey: priv }],
    })
    expect(identity.did.startsWith('did:key:')).toBe(true)
    const signed = await identity.sign({})
    expect(signed.payload.iss).toBe(identity.did)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/identity-create.test.ts`
Expected: FAIL — `createIdentity` not exported.

- [ ] **Step 3: Implement createIdentity**

Append to `packages/token/src/identity.ts`:

```ts
import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'

import { encodeMultibase } from './multibase.js'
import { encodePeer4, type DIDDoc } from './peer4.js'
import type { SignedHeader } from './schemas.js'
import type { SignedToken } from './types.js'

export type KeyPurpose = 'sig' | 'kem'
export type KeyAlg = 'EdDSA' | 'X25519'

export type IdentityKeySpec = {
  purpose: KeyPurpose
  alg: KeyAlg
  privateKey?: Uint8Array
}

export type CreateIdentityInput = {
  keys: Array<IdentityKeySpec>
  didMethod?: 'key' | 'peer:4'
}

export type ResolvedKey = {
  fragment: string
  alg: KeyAlg
  purpose: KeyPurpose
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export type SignOptions = {
  kid?: string
}

export type MultiKeyIdentity = {
  did: string
  longForm: string
  doc: DIDDoc
  keys: Array<ResolvedKey>
  sign<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options?: SignOptions,
  ): Promise<SignedToken<Payload>>
}

const CODEC_ED25519_PUB = new Uint8Array([0xed, 0x01])
const CODEC_X25519_PUB = new Uint8Array([0xec, 0x01])

function codecFor(alg: KeyAlg): Uint8Array {
  switch (alg) {
    case 'EdDSA':
      return CODEC_ED25519_PUB
    case 'X25519':
      return CODEC_X25519_PUB
  }
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function publicKeyMultibase(alg: KeyAlg, publicKey: Uint8Array): string {
  return encodeMultibase(concatBytes(codecFor(alg), publicKey))
}

function generateKeyPair(alg: KeyAlg, providedPrivate?: Uint8Array): {
  privateKey: Uint8Array
  publicKey: Uint8Array
} {
  switch (alg) {
    case 'EdDSA': {
      const priv = providedPrivate ?? ed25519.utils.randomSecretKey()
      return { privateKey: priv, publicKey: ed25519.getPublicKey(priv) }
    }
    case 'X25519': {
      const priv = providedPrivate ?? x25519.utils.randomSecretKey()
      return { privateKey: priv, publicKey: x25519.getPublicKey(priv) }
    }
  }
}

function isClassical(spec: IdentityKeySpec): boolean {
  return spec.alg === 'EdDSA' || spec.alg === 'X25519'
}

function chooseMethod(input: CreateIdentityInput): 'key' | 'peer:4' {
  if (input.didMethod != null) {
    if (input.didMethod === 'key') {
      if (input.keys.length !== 1) {
        throw new Error('IdentityError.InvalidMethod: did:key requires exactly one key')
      }
      if (!isClassical(input.keys[0])) {
        throw new Error('IdentityError.InvalidMethod: did:key requires a classical algorithm')
      }
      if (input.keys[0].purpose !== 'sig') {
        throw new Error('IdentityError.InvalidMethod: did:key requires a signing key')
      }
    }
    return input.didMethod
  }
  if (input.keys.length === 1 && isClassical(input.keys[0]) && input.keys[0].purpose === 'sig') {
    return 'key'
  }
  return 'peer:4'
}

function resolveKeys(input: CreateIdentityInput): Array<ResolvedKey> {
  return input.keys.map((spec, i) => {
    const { privateKey, publicKey } = generateKeyPair(spec.alg, spec.privateKey)
    return {
      fragment: `#key-${i}`,
      alg: spec.alg,
      purpose: spec.purpose,
      privateKey,
      publicKey,
    }
  })
}

function buildDoc(keys: Array<ResolvedKey>): DIDDoc {
  const verificationMethod = keys.map((k) => ({
    id: k.fragment,
    type: 'Multikey',
    publicKeyMultibase: publicKeyMultibase(k.alg, k.publicKey),
  }))
  const authentication = keys.filter((k) => k.purpose === 'sig').map((k) => k.fragment)
  const keyAgreement = keys.filter((k) => k.purpose === 'kem').map((k) => k.fragment)
  const doc: DIDDoc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    verificationMethod,
  }
  if (authentication.length > 0) doc.authentication = authentication
  if (keyAgreement.length > 0) doc.keyAgreement = keyAgreement
  return doc
}

function pickSigningKey(keys: Array<ResolvedKey>, kid?: string): ResolvedKey {
  if (kid != null) {
    const found = keys.find((k) => k.fragment === kid)
    if (found == null) throw new Error(`KidNotFound: ${kid}`)
    if (found.purpose !== 'sig') throw new Error(`Kid is not a signing key: ${kid}`)
    return found
  }
  const first = keys.find((k) => k.purpose === 'sig')
  if (first == null) throw new Error('No signing key in identity')
  return first
}

function signWith(key: ResolvedKey, data: Uint8Array): Uint8Array {
  switch (key.alg) {
    case 'EdDSA':
      return ed25519.sign(data, key.privateKey)
    case 'X25519':
      throw new Error('X25519 cannot sign')
  }
}

/**
 * Create a multi-key identity. The DID method is chosen automatically:
 * - single classical signing key → did:key
 * - anything else → did:peer:4
 *
 * Caller can override via `didMethod`. Invalid overrides throw IdentityError.InvalidMethod.
 */
export async function createIdentity(input: CreateIdentityInput): Promise<MultiKeyIdentity> {
  if (input.keys.length === 0) {
    throw new Error('createIdentity requires at least one key')
  }
  const method = chooseMethod(input)
  const keys = resolveKeys(input)

  if (method === 'key') {
    const [k] = keys
    const did = getDID(CODECS.EdDSA, k.publicKey)
    const doc: DIDDoc = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      verificationMethod: [
        { id: '#key-0', type: 'Multikey', publicKeyMultibase: publicKeyMultibase(k.alg, k.publicKey) },
      ],
      authentication: ['#key-0'],
    }
    return buildIdentity(did, did, doc, keys)
  }

  const doc = buildDoc(keys)
  const { longForm, shortForm } = encodePeer4(doc)
  return buildIdentity(shortForm, longForm, doc, keys)
}

function buildIdentity(
  did: string,
  longForm: string,
  doc: DIDDoc,
  keys: Array<ResolvedKey>,
): MultiKeyIdentity {
  async function sign<Payload extends Record<string, unknown> = Record<string, unknown>>(
    payload: Payload,
    options: SignOptions = {},
  ): Promise<SignedToken<Payload>> {
    const key = pickSigningKey(keys, options.kid)
    const header = {
      typ: 'JWT',
      alg: 'EdDSA',
      ...(did.startsWith('did:peer:4') ? { kid: key.fragment } : {}),
    } as SignedHeader
    const fullPayload = { ...payload, iss: did }
    const data = `${b64uFromJSON(header)}.${b64uFromJSON(fullPayload)}`
    return {
      header: header as SignedHeader & Record<string, unknown>,
      payload: fullPayload as Payload & { iss: string },
      signature: toB64U(signWith(key, fromUTF(data))),
      data,
    } as SignedToken<Payload>
  }

  return { did, longForm, doc, keys, sign }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/identity-create.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/identity.ts packages/token/test/identity-create.test.ts
git commit -m "feat(token): add createIdentity multi-key builder"
```

---

## Task 10: Rotation assertion helper

**Files:**
- Create: `packages/token/src/rotation.ts`
- Test: `packages/token/test/rotation.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/token/test/rotation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { createIdentity } from '../src/identity.js'
import { createInMemoryDIDCache } from '../src/cache.js'
import { createRotationAssertion } from '../src/rotation.js'
import { verifyToken } from '../src/token.js'

describe('createRotationAssertion', () => {
  it('produces a signed token linking old → new', async () => {
    const oldId = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    const newId = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    const assertion = await createRotationAssertion(oldId, newId)
    expect(assertion.payload.iss).toBe(oldId.did)
    expect(assertion.payload.type).toBe('did-rotation')
    expect(assertion.payload.to).toBe(newId.did)
    expect(assertion.payload.toLongForm).toBe(newId.longForm)
    expect(typeof assertion.payload.issuedAt).toBe('number')
  })

  it('verifies under the old identity', async () => {
    const oldId = await createIdentity({ keys: [{ purpose: 'sig', alg: 'EdDSA' }] })
    const newId = await createIdentity({
      keys: [
        { purpose: 'sig', alg: 'EdDSA' },
        { purpose: 'kem', alg: 'X25519' },
      ],
    })
    const assertion = await createRotationAssertion(oldId, newId)
    const cache = createInMemoryDIDCache()
    const verified = await verifyToken(assertion, undefined, undefined, {
      resolver: (did) => cache.get(did),
    })
    expect((verified as { verifiedPublicKey: Uint8Array }).verifiedPublicKey).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/token && pnpm exec vitest run test/rotation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement rotation helper**

`packages/token/src/rotation.ts`:

```ts
import type { MultiKeyIdentity } from './identity.js'
import type { SignedToken } from './types.js'

export type RotationPayload = {
  type: 'did-rotation'
  iss: string
  to: string
  toLongForm: string
  issuedAt: number
}

/**
 * Sign a rotation assertion linking an old identity to a new one.
 * The assertion is a regular signed token whose `iss` is the old DID.
 * Verifiers walking a rotation chain can use this to link related identities.
 */
export async function createRotationAssertion(
  oldIdentity: MultiKeyIdentity,
  newIdentity: MultiKeyIdentity,
  issuedAt: number = Math.floor(Date.now() / 1000),
): Promise<SignedToken<RotationPayload>> {
  return oldIdentity.sign<RotationPayload>({
    type: 'did-rotation',
    iss: oldIdentity.did,
    to: newIdentity.did,
    toLongForm: newIdentity.longForm,
    issuedAt,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/rotation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/rotation.ts packages/token/test/rotation.test.ts
git commit -m "feat(token): add rotation assertion helper"
```

---

## Task 11: Export new symbols from index.ts

**Files:**
- Modify: `packages/token/src/index.ts`

- [ ] **Step 1: Add export-coverage test**

`packages/token/test/exports.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import * as token from '../src/index.js'

describe('package exports', () => {
  it.each([
    'encodeMultibase',
    'decodeMultibase',
    'multihashSHA256',
    'verifyMultihash',
    'encodePeer4',
    'decodePeer4',
    'isPeer4',
    'getPeer4ShortForm',
    'validateDIDDoc',
    'createInMemoryDIDCache',
    'resolveIssuer',
    'createIdentity',
    'createRotationAssertion',
  ])('exports %s', (name) => {
    expect((token as Record<string, unknown>)[name]).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/token && pnpm exec vitest run test/exports.test.ts`
Expected: FAIL on each missing export.

- [ ] **Step 3: Update index.ts**

In `packages/token/src/index.ts`, append:

```ts
export {
  decodeMultibase,
  encodeMultibase,
  multihashSHA256,
  verifyMultihash,
} from './multibase.js'
export {
  decodePeer4,
  encodePeer4,
  getPeer4ShortForm,
  isPeer4,
  validateDIDDoc,
  type DecodePeer4Options,
  type DIDDoc,
  type VerificationMethod,
} from './peer4.js'
export {
  createInMemoryDIDCache,
  type DIDCache,
  type DIDResolver,
} from './cache.js'
export { resolveIssuer, type ResolveIssuerHeader } from './did.js'
export {
  createIdentity,
  type CreateIdentityInput,
  type IdentityKeySpec,
  type KeyAlg,
  type KeyPurpose,
  type MultiKeyIdentity,
  type ResolvedKey,
  type SignOptions,
} from './identity.js'
export { createRotationAssertion, type RotationPayload } from './rotation.js'
export { type VerifyTokenOptions } from './token.js'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/token && pnpm exec vitest run test/exports.test.ts`
Expected: PASS (13 named-export checks).

Also run full token suite + typecheck:

```bash
cd packages/token && pnpm test
```

Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/token/src/index.ts packages/token/test/exports.test.ts
git commit -m "feat(token): export did:peer:4 surface"
```

---

## Task 12: Full-workspace verification

**Files:** (none modified — verification only)

- [ ] **Step 1: Build all packages**

```bash
cd /Users/paul/dev/yulsi/enkaku && pnpm run build
```

Expected: build succeeds.

- [ ] **Step 2: Run all tests**

```bash
cd /Users/paul/dev/yulsi/enkaku && pnpm run test
```

Expected: all packages pass type checks and unit tests. The token package picks up new tests; downstream packages should be unaffected (resolver argument is optional everywhere).

- [ ] **Step 3: Lint**

```bash
cd /Users/paul/dev/yulsi/enkaku && pnpm run lint
```

Expected: no errors.

- [ ] **Step 4: Final commit if any lint fixes**

```bash
git status
# if there are changes from the linter:
git add -A
git commit -m "chore: lint fixes from did:peer:4 work"
```

---

## Deferred / follow-up

These items appear in the spec but are deferred to a follow-up plan because they touch packages outside `@enkaku/token` and need their own investigation:

- HTTP `X-Enkaku-Identity` and WebSocket handshake frame plumbing in `@enkaku/server` (`packages/server/test/peer4-handshake.test.ts` mentioned in spec).
- MLS `LeafNode` credential carrying long form in `@enkaku/group` (`packages/group/test/peer4-credential.test.ts` mentioned in spec).
- `provideIdentity(spec)` parallel API in each keystore package (`node-keystore`, `electron-keystore`, `browser-keystore`, `expo-keystore`).
- PQ algorithm integration (`noble-post-quantum`) — its own spec.

The token package alone is shippable after Task 12: `createIdentity` produces working multi-key identities, `verifyToken` accepts a resolver, and the cache/rotation helpers are usable by downstream code as-is.
