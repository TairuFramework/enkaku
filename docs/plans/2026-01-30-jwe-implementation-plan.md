# JWE Message-Level Encryption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add JWE (JSON Web Encryption) support to the Enkaku RPC framework, including identity type hierarchy, envelope modes, ECDH-ES key agreement, and client/server API integration.

**Architecture:** Replace `TokenSigner` with a new identity type hierarchy (`Identity`, `SigningIdentity`, `DecryptingIdentity`, `FullIdentity`) in `@enkaku/token`. Add JWE encryption/decryption using ECDH-ES (X25519 + P-256) with A256GCM. Support four envelope modes (`plain`, `jws`, `jws-in-jwe`, `jwe-in-jws`). Integrate into client, server, capability, standalone, and all keystore packages.

**Tech Stack:** TypeScript (ES2025, strict), `@noble/curves` (existing), `@noble/ciphers` (new), Web Crypto API (browser path), Vitest, pnpm workspaces, Biome

**Design doc:** `docs/plans/2026-01-30-jwe-message-encryption-design.md`

**Conventions:** `docs/agents/conventions.md` -- use `type` not `interface`, `Array<T>` not `T[]`, never `any`, `#privateField`, capital `ID`/`DID`/`JWT`, `test` not `it`, `.js` extensions in imports

---

## Phase 1: Identity Type Hierarchy (token package)

### Task 1: Add identity types and type guards

**Files:**
- Create: `packages/token/src/identity.ts`
- Test: `packages/token/test/identity.test.ts`

**Step 1: Write the failing test**

Create `packages/token/test/identity.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import type {
  DecryptingIdentity,
  FullIdentity,
  Identity,
  OwnIdentity,
  SigningIdentity,
} from '../src/identity.js'
import {
  isDecryptingIdentity,
  isFullIdentity,
  isSigningIdentity,
} from '../src/identity.js'

describe('identity type guards', () => {
  test('isSigningIdentity returns true for signing identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
      signToken: async () => ({} as never),
    }
    expect(isSigningIdentity(identity)).toBe(true)
  })

  test('isSigningIdentity returns false for plain identity', () => {
    const identity: Identity = { id: 'did:key:z123' }
    expect(isSigningIdentity(identity)).toBe(false)
  })

  test('isDecryptingIdentity returns true for decrypting identity', () => {
    const identity: DecryptingIdentity = {
      id: 'did:key:z123',
      decrypt: async () => new Uint8Array(),
      agreeKey: async () => new Uint8Array(),
    }
    expect(isDecryptingIdentity(identity)).toBe(true)
  })

  test('isDecryptingIdentity returns false for signing-only identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
      signToken: async () => ({} as never),
    }
    expect(isDecryptingIdentity(identity)).toBe(false)
  })

  test('isFullIdentity returns true for full identity', () => {
    const identity: FullIdentity = {
      id: 'did:key:z123',
      signToken: async () => ({} as never),
      decrypt: async () => new Uint8Array(),
      agreeKey: async () => new Uint8Array(),
    }
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('isFullIdentity returns false for signing-only identity', () => {
    const identity: SigningIdentity = {
      id: 'did:key:z123',
      signToken: async () => ({} as never),
    }
    expect(isFullIdentity(identity)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/token/test/identity.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `packages/token/src/identity.ts`:

```typescript
import type { SignedToken } from './types.js'

export type Identity = { readonly id: string }

export type SigningIdentity = Identity & {
  signToken: <
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(
    payload: Payload,
    header?: Header,
  ) => Promise<SignedToken<Payload, Header>>
}

export type DecryptingIdentity = Identity & {
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array>
}

export type FullIdentity = SigningIdentity & DecryptingIdentity

export type OwnIdentity = FullIdentity & { privateKey: Uint8Array }

export function isSigningIdentity(identity: Identity): identity is SigningIdentity {
  return 'signToken' in identity && typeof (identity as SigningIdentity).signToken === 'function'
}

export function isDecryptingIdentity(identity: Identity): identity is DecryptingIdentity {
  return (
    'decrypt' in identity &&
    typeof (identity as DecryptingIdentity).decrypt === 'function' &&
    'agreeKey' in identity &&
    typeof (identity as DecryptingIdentity).agreeKey === 'function'
  )
}

export function isFullIdentity(identity: Identity): identity is FullIdentity {
  return isSigningIdentity(identity) && isDecryptingIdentity(identity)
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/token/test/identity.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```
feat(token): add identity type hierarchy and type guards

Introduce Identity, SigningIdentity, DecryptingIdentity, FullIdentity,
and OwnIdentity types with isSigningIdentity, isDecryptingIdentity,
and isFullIdentity type guard functions.
```

---

### Task 2: Add identity factory functions (Ed25519)

**Files:**
- Modify: `packages/token/src/identity.ts`
- Modify: `packages/token/test/identity.test.ts`

**Step 1: Write the failing tests**

Add to `packages/token/test/identity.test.ts`:

```typescript
import { ed25519 } from '@noble/curves/ed25519.js'

import {
  createDecryptingIdentity,
  createFullIdentity,
  createSigningIdentity,
  isDecryptingIdentity,
  isFullIdentity,
  isSigningIdentity,
  randomIdentity,
} from '../src/identity.js'
import { verifyToken } from '../src/token.js'

describe('createSigningIdentity', () => {
  test('creates a signing identity from Ed25519 private key', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const identity = createSigningIdentity(privateKey)
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isSigningIdentity(identity)).toBe(true)
    const token = await identity.signToken({ test: true })
    expect(token.payload.iss).toBe(identity.id)
    const verified = await verifyToken(token)
    expect(verified).toBeDefined()
  })
})

describe('createFullIdentity', () => {
  test('creates a full identity from Ed25519 private key', () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const identity = createFullIdentity(privateKey)
    expect(identity.id).toMatch(/^did:key:z/)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('same private key produces same id', () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const id1 = createFullIdentity(privateKey)
    const id2 = createFullIdentity(privateKey)
    expect(id2.id).toBe(id1.id)
  })
})

describe('randomIdentity', () => {
  test('generates a random identity with private key', () => {
    const identity = randomIdentity()
    expect(identity.id).toMatch(/^did:key:z/)
    expect(identity.privateKey).toBeInstanceOf(Uint8Array)
    expect(isFullIdentity(identity)).toBe(true)
  })

  test('generates unique identities', () => {
    const id1 = randomIdentity()
    const id2 = randomIdentity()
    expect(id2.id).not.toBe(id1.id)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/token/test/identity.test.ts`
Expected: FAIL (functions not exported)

**Step 3: Write minimal implementation**

Add to `packages/token/src/identity.ts`:

```typescript
import { b64uFromJSON, fromUTF, toB64U } from '@enkaku/codec'
import { ed25519 } from '@noble/curves/ed25519.js'
import { edwardsToMontgomeryPriv, edwardsToMontgomeryPub } from '@noble/curves/ed25519'

import { CODECS, getDID } from './did.js'
import type { SignedHeader } from './schemas.js'
import type { SignedToken } from './types.js'

// ... existing type definitions and type guards ...

export function createSigningIdentity(privateKey: Uint8Array): SigningIdentity {
  const publicKey = ed25519.getPublicKey(privateKey)
  const id = getDID(CODECS.EdDSA, publicKey)

  async function signToken<
    Payload extends Record<string, unknown> = Record<string, unknown>,
    Header extends Record<string, unknown> = Record<string, unknown>,
  >(payload: Payload, header?: Header): Promise<SignedToken<Payload, Header>> {
    if (payload.iss != null && payload.iss !== id) {
      throw new Error(`Invalid payload with issuer ${payload.iss} used with identity ${id}`)
    }
    const fullHeader = { ...header, typ: 'JWT', alg: 'EdDSA' } as SignedHeader & Header
    const fullPayload = { ...payload, iss: id }
    const data = `${b64uFromJSON(fullHeader)}.${b64uFromJSON(fullPayload)}`
    return {
      header: fullHeader,
      payload: fullPayload,
      signature: toB64U(ed25519.sign(fromUTF(data), privateKey)),
      data,
    }
  }

  return { id, signToken }
}

export function createDecryptingIdentity(privateKey: Uint8Array): DecryptingIdentity {
  const publicKey = ed25519.getPublicKey(privateKey)
  const id = getDID(CODECS.EdDSA, publicKey)
  const x25519Private = edwardsToMontgomeryPriv(privateKey)

  async function agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array> {
    const { x25519 } = await import('@noble/curves/ed25519')
    return x25519.getSharedSecret(x25519Private, ephemeralPublicKey)
  }

  async function decrypt(_jwe: string): Promise<Uint8Array> {
    // JWE decryption will be implemented in Task 5
    throw new Error('Not implemented')
  }

  return { id, decrypt, agreeKey }
}

export function createFullIdentity(privateKey: Uint8Array): FullIdentity {
  const signing = createSigningIdentity(privateKey)
  const decrypting = createDecryptingIdentity(privateKey)
  return { ...signing, ...decrypting }
}

export function randomIdentity(): OwnIdentity {
  const privateKey = ed25519.utils.randomSecretKey()
  return { ...createFullIdentity(privateKey), privateKey }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/token/test/identity.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(token): add identity factory functions for Ed25519

Add createSigningIdentity, createDecryptingIdentity, createFullIdentity,
and randomIdentity functions with Ed25519 key support and X25519
key derivation for ECDH.
```

---

### Task 3: Export identity types from token barrel and update signToken

**Files:**
- Modify: `packages/token/src/index.ts`
- Modify: `packages/token/src/token.ts:83-90` (change `signToken` parameter type)
- Modify: `packages/token/test/token.test.ts`

**Step 1: Update signToken to accept SigningIdentity**

In `packages/token/src/token.ts`, change the import on line 13 and the `signToken` function (lines 83-90):

Replace:
```typescript
import type { SignedToken, Token, TokenSigner, UnsignedToken, VerifiedToken } from './types.js'
```
With:
```typescript
import type { SigningIdentity } from './identity.js'
import type { SignedToken, Token, UnsignedToken, VerifiedToken } from './types.js'
```

Replace `signToken`:
```typescript
export async function signToken<
  Payload extends Record<string, unknown>,
  Header extends Record<string, unknown>,
>(signer: SigningIdentity, token: Token<Payload, Header>): Promise<SignedToken<Payload, Header>> {
  return isSignedToken(token)
    ? (token as SignedToken<Payload, Header>)
    : await signer.signToken(token.payload, token.header)
}
```

**Step 2: Update token.test.ts to use randomIdentity**

In `packages/token/test/token.test.ts`, replace all `randomTokenSigner()` calls with `randomIdentity()`, update imports, and change `signer.createToken(...)` to `identity.signToken(...)`.

Replace import:
```typescript
import { randomIdentity } from '../src/identity.js'
```

Replace all occurrences of:
- `const signer = randomTokenSigner()` → `const identity = randomIdentity()`
- `signer.createToken(...)` → `identity.signToken(...)`
- `signer.id` → `identity.id`
- `signer.privateKey` → `identity.privateKey`
- `signToken(signer, ...)` → `signToken(identity, ...)`

**Step 3: Update barrel exports**

In `packages/token/src/index.ts`:

Add new export:
```typescript
export {
  createDecryptingIdentity,
  createFullIdentity,
  createSigningIdentity,
  isDecryptingIdentity,
  isFullIdentity,
  isSigningIdentity,
  randomIdentity,
} from './identity.js'
export type {
  DecryptingIdentity,
  FullIdentity,
  Identity,
  OwnIdentity,
  SigningIdentity,
} from './identity.js'
```

Keep the old signer exports for now (they will be removed in Phase 4 after all consumers are updated).

**Step 4: Run tests**

Run: `pnpm vitest run packages/token/test/`
Expected: PASS (all token tests)

**Step 5: Commit**

```
feat(token): export identity types and update signToken to use SigningIdentity

Update signToken() to accept SigningIdentity instead of TokenSigner.
Export all identity types and factory functions from the token barrel.
Update token tests to use randomIdentity().
```

---

## Phase 2: JWE Crypto Primitives (token package)

### Task 4: Add @noble/ciphers dependency and Concat KDF

**Files:**
- Modify: `packages/token/package.json` (add `@noble/ciphers` dependency)
- Create: `packages/token/src/jwe.ts`
- Test: `packages/token/test/jwe.test.ts`

**Step 1: Add dependency**

Run: `pnpm add @noble/ciphers --filter @enkaku/token`

Check if `@noble/ciphers` should go in pnpm catalog (`pnpm-workspace.yaml`). If `@noble/curves` is in the catalog, add `@noble/ciphers` there too.

**Step 2: Write the failing test for Concat KDF**

Create `packages/token/test/jwe.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { concatKDF } from '../src/jwe.js'

describe('concatKDF', () => {
  test('derives 256-bit key from shared secret', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const key = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  test('different algorithmID produces different key', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const key1 = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    const key2 = concatKDF({
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256KW',
      partyUInfo: new Uint8Array(0),
      partyVInfo: new Uint8Array(0),
    })
    expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false)
  })

  test('different partyInfo produces different key', () => {
    const sharedSecret = new Uint8Array(32).fill(0xab)
    const params = {
      sharedSecret,
      keyLength: 256,
      algorithmID: 'A256GCM',
    }
    const key1 = concatKDF({ ...params, partyUInfo: new Uint8Array([1]), partyVInfo: new Uint8Array(0) })
    const key2 = concatKDF({ ...params, partyUInfo: new Uint8Array([2]), partyVInfo: new Uint8Array(0) })
    expect(Buffer.from(key1).equals(Buffer.from(key2))).toBe(false)
  })
})
```

**Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/token/test/jwe.test.ts`
Expected: FAIL (module not found)

**Step 4: Implement Concat KDF**

Create `packages/token/src/jwe.ts`:

```typescript
import { sha256 } from '@noble/ciphers/sha256'

export type ConcatKDFParams = {
  sharedSecret: Uint8Array
  keyLength: number
  algorithmID: string
  partyUInfo: Uint8Array
  partyVInfo: Uint8Array
}

function uint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  view.setUint32(0, value, false)
  return buf
}

function lengthPrefixed(data: Uint8Array): Uint8Array {
  const prefix = uint32BE(data.length)
  const result = new Uint8Array(4 + data.length)
  result.set(prefix)
  result.set(data, 4)
  return result
}

/**
 * Concat KDF per RFC 7518 Section 4.6.2.
 * Single SHA-256 iteration (sufficient for 256-bit keys).
 */
export function concatKDF(params: ConcatKDFParams): Uint8Array {
  const { sharedSecret, keyLength, algorithmID, partyUInfo, partyVInfo } = params
  const encoder = new TextEncoder()

  const algID = lengthPrefixed(encoder.encode(algorithmID))
  const apu = lengthPrefixed(partyUInfo)
  const apv = lengthPrefixed(partyVInfo)
  const keyDataLen = uint32BE(keyLength)

  // round = 1 (single iteration for 256-bit key)
  const round = uint32BE(1)

  // Hash(round || sharedSecret || algID || apu || apv || keyDataLen)
  const hashInput = new Uint8Array(
    round.length + sharedSecret.length + algID.length + apu.length + apv.length + keyDataLen.length,
  )
  let offset = 0
  for (const part of [round, sharedSecret, algID, apu, apv, keyDataLen]) {
    hashInput.set(part, offset)
    offset += part.length
  }

  return sha256(hashInput).slice(0, keyLength / 8)
}
```

Note: The `sha256` import path may need to be adjusted based on `@noble/ciphers` API. Check the actual export path -- it might be `@noble/ciphers/sha2` or similar. Verify with `@noble/ciphers` package docs.

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/token/test/jwe.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(token): add Concat KDF implementation for JWE key derivation

Implement RFC 7518 Section 4.6.2 Concat KDF with SHA-256.
Add @noble/ciphers dependency for AES-GCM.
```

---

### Task 5: Add ECDH-ES + AES-256-GCM encrypt/decrypt

**Files:**
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/test/jwe.test.ts`

**Step 1: Write the failing tests**

Add to `packages/token/test/jwe.test.ts`:

```typescript
import { ed25519 } from '@noble/curves/ed25519.js'
import { edwardsToMontgomeryPub } from '@noble/curves/ed25519'

import { createTokenEncrypter, decryptToken, encryptToken } from '../src/jwe.js'
import { createDecryptingIdentity } from '../src/identity.js'

describe('JWE encrypt and decrypt', () => {
  test('round-trip encrypt/decrypt with X25519 ECDH-ES', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)
    const x25519Public = edwardsToMontgomeryPub(publicKey)

    const encrypter = createTokenEncrypter(x25519Public, { algorithm: 'X25519' })
    const decrypter = createDecryptingIdentity(privateKey)

    const plaintext = new TextEncoder().encode('hello world')
    const jwe = await encryptToken(encrypter, plaintext)
    const decrypted = await decryptToken(decrypter, jwe)

    expect(new TextDecoder().decode(decrypted)).toBe('hello world')
  })

  test('JWE compact serialization has 5 parts', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)
    const x25519Public = edwardsToMontgomeryPub(publicKey)

    const encrypter = createTokenEncrypter(x25519Public, { algorithm: 'X25519' })
    const plaintext = new TextEncoder().encode('test')
    const jwe = await encryptToken(encrypter, plaintext)

    const parts = jwe.split('.')
    expect(parts.length).toBe(5)
    // For ECDH-ES direct, encrypted key is empty
    expect(parts[1]).toBe('')
  })

  test('decrypt fails with wrong key', async () => {
    const privateKey1 = ed25519.utils.randomSecretKey()
    const publicKey1 = ed25519.getPublicKey(privateKey1)
    const x25519Public1 = edwardsToMontgomeryPub(publicKey1)

    const privateKey2 = ed25519.utils.randomSecretKey()

    const encrypter = createTokenEncrypter(x25519Public1, { algorithm: 'X25519' })
    const decrypter = createDecryptingIdentity(privateKey2)

    const plaintext = new TextEncoder().encode('secret')
    const jwe = await encryptToken(encrypter, plaintext)

    await expect(decryptToken(decrypter, jwe)).rejects.toThrow()
  })
})

describe('createTokenEncrypter', () => {
  test('caches recipient public key across encrypt calls', async () => {
    const privateKey = ed25519.utils.randomSecretKey()
    const publicKey = ed25519.getPublicKey(privateKey)
    const x25519Public = edwardsToMontgomeryPub(publicKey)

    const encrypter = createTokenEncrypter(x25519Public, { algorithm: 'X25519' })
    const decrypter = createDecryptingIdentity(privateKey)

    const plaintext = new TextEncoder().encode('test')
    const jwe1 = await encryptToken(encrypter, plaintext)
    const jwe2 = await encryptToken(encrypter, plaintext)

    // Different JWEs (different ephemeral keys / IVs)
    expect(jwe1).not.toBe(jwe2)

    // Both decrypt correctly
    const d1 = await decryptToken(decrypter, jwe1)
    const d2 = await decryptToken(decrypter, jwe2)
    expect(new TextDecoder().decode(d1)).toBe('test')
    expect(new TextDecoder().decode(d2)).toBe('test')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/token/test/jwe.test.ts`
Expected: FAIL (functions not exported)

**Step 3: Implement JWE encrypt/decrypt**

Add to `packages/token/src/jwe.ts` the full JWE implementation:

- `TokenEncrypter` type and `createTokenEncrypter` factory
- `encryptToken` using ECDH-ES direct + AES-256-GCM
- `decryptToken` parsing JWE compact serialization and decrypting
- Use `@noble/curves/ed25519` for X25519 ephemeral key generation and ECDH
- Use `@noble/ciphers/aes` for `gcm` encryption/decryption
- Use `@enkaku/codec` for base64url encoding/decoding

Key implementation details:
- `createTokenEncrypter` stores the recipient public key and algorithm internally
- `encryptToken` generates a fresh ephemeral X25519 key pair per call, computes shared secret, derives CEK via concatKDF, encrypts with AES-256-GCM, and produces JWE compact serialization
- `decryptToken` parses the 5-part compact string, extracts the ephemeral public key from the protected header, calls `decrypter.agreeKey()`, derives CEK, and decrypts
- Update `createDecryptingIdentity` in `identity.ts` to implement `decrypt` using the jwe module

**Step 4: Run tests**

Run: `pnpm vitest run packages/token/test/jwe.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(token): add JWE encrypt/decrypt with ECDH-ES and A256GCM

Implement TokenEncrypter, createTokenEncrypter, encryptToken, and
decryptToken with X25519 ECDH-ES direct key agreement and AES-256-GCM
content encryption. JWE compact serialization per RFC 7516.
```

---

### Task 6: Add DID-based TokenEncrypter creation

**Files:**
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/test/jwe.test.ts`

**Step 1: Write the failing test**

Add to `packages/token/test/jwe.test.ts`:

```typescript
import { randomIdentity } from '../src/identity.js'

describe('createTokenEncrypter from DID', () => {
  test('creates encrypter from Ed25519 DID string', async () => {
    const identity = randomIdentity()
    const encrypter = createTokenEncrypter(identity.id)
    expect(encrypter.recipientID).toBe(identity.id)

    const plaintext = new TextEncoder().encode('from DID')
    const jwe = await encryptToken(encrypter, plaintext)
    const decrypted = await decryptToken(identity, jwe)
    expect(new TextDecoder().decode(decrypted)).toBe('from DID')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/token/test/jwe.test.ts`
Expected: FAIL

**Step 3: Implement DID-based encrypter creation**

Update `createTokenEncrypter` in `packages/token/src/jwe.ts` to accept a DID string:
- If the recipient is a string starting with `did:key:z`, parse it using `getSignatureInfo` from `./did.js`
- For EdDSA keys, convert the public key to X25519 using `edwardsToMontgomeryPub`
- For ES256 keys, use the P-256 public key directly (P-256 ECDH support will come in a later task)
- Set `recipientID` to the DID string

**Step 4: Run tests**

Run: `pnpm vitest run packages/token/test/jwe.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(token): support DID-based TokenEncrypter creation

createTokenEncrypter now accepts a DID string and extracts the
encryption public key from it. Ed25519 DIDs are converted to X25519
for ECDH key agreement.
```

---

### Task 7: Add envelope wrapping/unwrapping

**Files:**
- Modify: `packages/token/src/jwe.ts` (add wrapEnvelope, unwrapEnvelope)
- Create: `packages/token/test/envelope.test.ts`

**Step 1: Write the failing tests**

Create `packages/token/test/envelope.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'

import { randomIdentity } from '../src/identity.js'
import { createTokenEncrypter, unwrapEnvelope, wrapEnvelope } from '../src/jwe.js'
import type { EnvelopeMode, UnwrappedEnvelope } from '../src/jwe.js'

describe('wrapEnvelope / unwrapEnvelope', () => {
  test('plain mode round-trip', async () => {
    const payload = { typ: 'request', prc: 'test', rid: '123', prm: {} }
    const wrapped = await wrapEnvelope('plain', payload, {})
    const result = await unwrapEnvelope(wrapped, {})
    expect(result.mode).toBe('plain')
    expect(result.payload.typ).toBe('request')
  })

  test('jws mode round-trip', async () => {
    const identity = randomIdentity()
    const payload = { typ: 'request', prc: 'test', rid: '123', prm: {} }
    const wrapped = await wrapEnvelope('jws', payload, { signer: identity })
    const result = await unwrapEnvelope(wrapped, {})
    expect(result.mode).toBe('jws')
    expect(result.payload.prc).toBe('test')
  })

  test('jws-in-jwe mode round-trip', async () => {
    const sender = randomIdentity()
    const recipient = randomIdentity()
    const encrypter = createTokenEncrypter(recipient.id)
    const payload = { typ: 'request', prc: 'secret', rid: '456', prm: { key: 'value' } }

    const wrapped = await wrapEnvelope('jws-in-jwe', payload, {
      signer: sender,
      encrypter,
    })
    const result = await unwrapEnvelope(wrapped, { decrypter: recipient })
    expect(result.mode).toBe('jws-in-jwe')
    expect(result.payload.prc).toBe('secret')
  })

  test('jwe-in-jws mode round-trip', async () => {
    const sender = randomIdentity()
    const recipient = randomIdentity()
    const encrypter = createTokenEncrypter(recipient.id)
    const payload = { typ: 'request', prc: 'secret', rid: '789', prm: {} }

    const wrapped = await wrapEnvelope('jwe-in-jws', payload, {
      signer: sender,
      encrypter,
    })
    const result = await unwrapEnvelope(wrapped, { decrypter: recipient })
    expect(result.mode).toBe('jwe-in-jws')
    expect(result.payload.prc).toBe('secret')
  })

  test('wrapEnvelope throws if jws mode but no signer', async () => {
    const payload = { typ: 'request', prc: 'test', rid: '1' }
    await expect(wrapEnvelope('jws', payload, {})).rejects.toThrow()
  })

  test('wrapEnvelope throws if encrypted mode but no encrypter', async () => {
    const identity = randomIdentity()
    const payload = { typ: 'request', prc: 'test', rid: '1' }
    await expect(
      wrapEnvelope('jws-in-jwe', payload, { signer: identity }),
    ).rejects.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/token/test/envelope.test.ts`
Expected: FAIL

**Step 3: Implement wrapEnvelope / unwrapEnvelope**

Add to `packages/token/src/jwe.ts`:

```typescript
export type EnvelopeMode = 'plain' | 'jws' | 'jws-in-jwe' | 'jwe-in-jws'

export type UnwrappedEnvelope = {
  payload: Record<string, unknown>
  mode: EnvelopeMode
}

export async function wrapEnvelope(
  mode: EnvelopeMode,
  payload: Record<string, unknown>,
  options: {
    signer?: SigningIdentity
    encrypter?: TokenEncrypter
    header?: Record<string, unknown>
  },
): Promise<string> {
  switch (mode) {
    case 'plain': {
      const token = createUnsignedToken(payload, options.header)
      return stringifyToken(token)
    }
    case 'jws': {
      if (options.signer == null) throw new Error('Signer required for jws mode')
      const token = await options.signer.signToken(payload, options.header)
      return stringifyToken(token)
    }
    case 'jws-in-jwe': {
      if (options.signer == null) throw new Error('Signer required for jws-in-jwe mode')
      if (options.encrypter == null) throw new Error('Encrypter required for jws-in-jwe mode')
      const signed = await options.signer.signToken(payload, options.header)
      const jwsString = stringifyToken(signed)
      return encryptToken(options.encrypter, new TextEncoder().encode(jwsString))
    }
    case 'jwe-in-jws': {
      if (options.signer == null) throw new Error('Signer required for jwe-in-jws mode')
      if (options.encrypter == null) throw new Error('Encrypter required for jwe-in-jws mode')
      const plaintext = new TextEncoder().encode(JSON.stringify(payload))
      const jwe = await encryptToken(options.encrypter, plaintext)
      return stringifyToken(await options.signer.signToken({ jwe }, options.header))
    }
  }
}

export async function unwrapEnvelope(
  message: string,
  options: {
    decrypter?: DecryptingIdentity
    verifiers?: Verifiers
  },
): Promise<UnwrappedEnvelope> {
  // Detect format: JWE has 5 dot-separated parts, JWT has 3
  const parts = message.split('.')
  if (parts.length === 5) {
    // JWE outer → jws-in-jwe mode
    if (options.decrypter == null) throw new Error('Decrypter required for JWE message')
    const decrypted = await decryptToken(options.decrypter, message)
    const jwsString = new TextDecoder().decode(decrypted)
    const token = await verifyToken(jwsString, options.verifiers)
    return { payload: token.payload, mode: 'jws-in-jwe' }
  }
  if (parts.length === 3) {
    // JWT: could be plain, jws, or jwe-in-jws
    const token = await verifyToken(message, options.verifiers)
    if (isUnsignedToken(token)) {
      return { payload: token.payload, mode: 'plain' }
    }
    // Check if payload contains a JWE (jwe-in-jws)
    if ('jwe' in token.payload && typeof token.payload.jwe === 'string') {
      if (options.decrypter == null) throw new Error('Decrypter required for jwe-in-jws message')
      const decrypted = await decryptToken(options.decrypter, token.payload.jwe as string)
      const innerPayload = JSON.parse(new TextDecoder().decode(decrypted))
      return { payload: innerPayload, mode: 'jwe-in-jws' }
    }
    return { payload: token.payload, mode: 'jws' }
  }
  throw new Error(`Invalid envelope format: expected 3 or 5 dot-separated parts, got ${parts.length}`)
}
```

**Step 4: Run tests**

Run: `pnpm vitest run packages/token/test/envelope.test.ts`
Expected: PASS

**Step 5: Export new types from barrel**

Add to `packages/token/src/index.ts`:
```typescript
export {
  concatKDF,
  createTokenEncrypter,
  decryptToken,
  encryptToken,
  unwrapEnvelope,
  wrapEnvelope,
} from './jwe.js'
export type {
  ConcatKDFParams,
  EncryptOptions,
  EnvelopeMode,
  JWEHeader,
  JWEJSONSerialization,
  TokenEncrypter,
  UnwrappedEnvelope,
} from './jwe.js'
```

**Step 6: Run all token tests**

Run: `pnpm vitest run packages/token/test/`
Expected: PASS

**Step 7: Commit**

```
feat(token): add envelope wrapping/unwrapping for all four modes

Implement wrapEnvelope and unwrapEnvelope supporting plain, jws,
jws-in-jwe, and jwe-in-jws envelope modes. Auto-detect mode on
unwrap from token structure. Export all JWE types and functions.
```

---

## Phase 3: Migrate Consumers to Identity Types

### Task 8: Update @enkaku/capability

**Files:**
- Modify: `packages/capability/src/index.ts:18,121` (import + parameter type)
- Modify: `packages/capability/test/lib.test.ts`

**Step 1: Update createCapability parameter type**

In `packages/capability/src/index.ts`:

Change import (line 13-20):
```typescript
import {
  isVerifiedToken,
  type SignedHeader,
  type SignedPayload,
  type SignedToken,
  type SigningIdentity,
  verifyToken,
} from '@enkaku/token'
```

Change `createCapability` signature (line 121):
```typescript
  signer: SigningIdentity,
```

Change `signer.createToken` calls (lines 130, 171) to `signer.signToken`.

**Step 2: Update capability tests**

In `packages/capability/test/lib.test.ts`, replace all `randomTokenSigner()` with `randomIdentity()`, update import from `@enkaku/token` to import `randomIdentity` instead of `randomTokenSigner`, and change `signer.createToken(...)` to `identity.signToken(...)`.

**Step 3: Run tests**

Run: `pnpm vitest run packages/capability/test/`
Expected: PASS

**Step 4: Commit**

```
feat(capability): migrate createCapability to use SigningIdentity

Replace TokenSigner parameter with SigningIdentity. Update
signer.createToken() calls to identity.signToken().
```

---

### Task 9: Update @enkaku/client

**Files:**
- Modify: `packages/client/src/client.ts:20,191-207,213-223,247`
- Modify: `packages/client/test/lib.test.ts`

**Step 1: Update client source**

In `packages/client/src/client.ts`:

Change import (line 20):
```typescript
import { createUnsignedToken, type Identity, isSigningIdentity, type SigningIdentity } from '@enkaku/token'
```

Update `getCreateMessage` function (lines 191-207):
```typescript
function getCreateMessage<Protocol extends ProtocolDefinition>(
  identity?: Identity | Promise<Identity>,
  aud?: string,
): CreateMessage<Protocol> {
  if (identity == null) {
    return createUnsignedToken
  }

  const identityPromise = Promise.resolve(identity)
  const createToken = (payload: Record<string, unknown>, header?: AnyHeader) => {
    return identityPromise.then((id) => {
      if (!isSigningIdentity(id)) {
        throw new Error('Identity does not support signing')
      }
      return id.signToken(payload, header)
    })
  }

  return (
    aud ? (payload, header) => createToken({ aud, ...payload }, header) : createToken
  ) as CreateMessage<Protocol>
}
```

Update `ClientParams` (lines 213-223):
```typescript
export type ClientParams<Protocol extends ProtocolDefinition> = {
  getRandomID?: () => string
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  handleTransportDisposed?: (signal: AbortSignal) => ClientTransportOf<Protocol> | void
  // biome-ignore lint/suspicious/noConfusingVoidType: return type
  handleTransportError?: (error: Error) => ClientTransportOf<Protocol> | void
  logger?: Logger
  transport: ClientTransportOf<Protocol>
  serverID?: string
  identity?: Identity | Promise<Identity>
}
```

Update constructor (line 247):
```typescript
this.#createMessage = getCreateMessage<Protocol>(params.identity, params.serverID)
```

**Step 2: Update client tests**

In `packages/client/test/lib.test.ts`, replace `randomTokenSigner()` with `randomIdentity()`, `signer:` with `identity:`, and update imports.

**Step 3: Run tests**

Run: `pnpm vitest run packages/client/test/`
Expected: PASS

**Step 4: Commit**

```
feat(client): replace signer param with identity

Migrate ClientParams from signer?: TokenSigner to identity?: Identity.
Update getCreateMessage to use SigningIdentity.signToken().
```

---

### Task 10: Update @enkaku/server

**Files:**
- Modify: `packages/server/src/server.ts:311-321,376-392`
- Modify: `packages/server/src/access-control.ts`
- Modify: `packages/server/test/lib.test.ts`
- Modify: `packages/server/test/access-control.test.ts`
- Modify: `packages/server/test/channel-send-auth.test.ts`
- Modify: `packages/server/test/event-auth.test.ts`

**Step 1: Update ServerParams**

In `packages/server/src/server.ts`:

Add import:
```typescript
import { type Identity } from '@enkaku/token'
```

Update `ServerParams` (lines 311-321):
```typescript
export type ServerParams<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  handlers: ProcedureHandlers<Protocol>
  identity?: Identity
  limits?: Partial<ResourceLimits>
  logger?: Logger
  protocol?: Protocol
  public?: boolean
  signal?: AbortSignal
  transports?: Array<ServerTransportOf<Protocol>>
}
```

Update constructor (lines 376-392) to use `params.identity?.id` instead of `params.id`:
```typescript
const serverID = params.identity?.id
this.#logger =
  params.logger ?? getEnkakuLogger('server', { serverID: serverID ?? crypto.randomUUID() })

if (serverID == null) {
  if (params.public) {
    this.#accessControl = { public: true, access: params.access }
  } else {
    throw new Error(
      'Invalid server parameters: either the server "identity" must be provided or the "public" parameter must be set to true',
    )
  }
} else {
  this.#accessControl = {
    public: !!params.public,
    serverID,
    access: params.access ?? {},
  }
}
```

**Step 2: Update server tests**

In all server test files, replace:
- `randomTokenSigner()` → `randomIdentity()`
- `id: signer.id` → `identity: identity` (in serve/Server params)
- Update imports

**Step 3: Run tests**

Run: `pnpm vitest run packages/server/test/`
Expected: PASS

**Step 4: Commit**

```
feat(server): replace id param with identity

Migrate ServerParams from id?: string to identity?: Identity.
Derive serverID from identity.id internally.
```

---

### Task 11: Update @enkaku/standalone

**Files:**
- Modify: `packages/standalone/src/index.ts`
- Modify: `packages/standalone/test/lib.test.ts`

**Step 1: Update standalone source**

In `packages/standalone/src/index.ts`:

Replace import (line 16):
```typescript
import type { Identity } from '@enkaku/token'
```

Update `StandaloneOptions` (line 19-25):
```typescript
export type StandaloneOptions<Protocol extends ProtocolDefinition> = {
  access?: ProcedureAccessRecord
  getRandomID?: () => string
  protocol?: Protocol
  signal?: AbortSignal
  identity?: Identity
}
```

Update `standalone` function body (lines 31-47):
```typescript
const { access, getRandomID, protocol, signal, identity } = options
const transports = new DirectTransports<
  AnyServerMessageOf<Protocol>,
  AnyClientMessageOf<Protocol>
>({ signal })

const serverID = identity ? identity.id : undefined
serve<Protocol>({
  access,
  handlers,
  identity,
  protocol,
  public: serverID == null,
  signal,
  transport: transports.server,
})
return new Client<Protocol>({ getRandomID, serverID, identity, transport: transports.client })
```

**Step 2: Update standalone tests**

Replace `randomTokenSigner()` with `randomIdentity()`, `signer` with `identity`.

**Step 3: Run tests**

Run: `pnpm vitest run packages/standalone/test/`
Expected: PASS

**Step 4: Commit**

```
feat(standalone): replace signer param with identity

Migrate StandaloneOptions from signer?: TokenSigner to identity?: Identity.
```

---

## Phase 4: Remove Old APIs and Update Keystores

### Task 12: Remove TokenSigner and old signer functions from token package

**Files:**
- Modify: `packages/token/src/types.ts` (remove TokenSigner, OwnTokenSigner, GenericSigner, OwnSigner)
- Modify: `packages/token/src/signer.ts` (remove getSigner, toTokenSigner, getTokenSigner, randomTokenSigner, randomSigner)
- Modify: `packages/token/src/index.ts` (remove old exports)
- Modify: `packages/token/test/sign-verify.test.ts` (rewrite to use identity)

**Step 1: Remove types from types.ts**

In `packages/token/src/types.ts`, remove `GenericSigner` (lines 3-7), `OwnSigner` (line 9), `TokenSigner` (lines 21-30), and `OwnTokenSigner` (lines 32-34). Keep `SignedToken`, `UnsignedToken`, `VerifiedToken`, `Token`.

**Step 2: Remove functions from signer.ts**

In `packages/token/src/signer.ts`, remove `getSigner`, `randomSigner`, `toTokenSigner`, `getTokenSigner`, `randomTokenSigner`. Keep `randomPrivateKey`, `decodePrivateKey`, `encodePrivateKey`.

**Step 3: Update barrel exports**

In `packages/token/src/index.ts`, remove:
```typescript
getSigner,
getTokenSigner,
randomSigner,
randomTokenSigner,
toTokenSigner,
```

**Step 4: Rewrite sign-verify test**

Rewrite `packages/token/test/sign-verify.test.ts` to test using `createFullIdentity`, `randomIdentity`, and direct `@noble/curves` for low-level signature verification.

**Step 5: Run all token tests**

Run: `pnpm vitest run packages/token/test/`
Expected: PASS

**Step 6: Run full test suite to catch remaining references**

Run: `pnpm run test`
Expected: Might fail in packages not yet updated -- verify.

**Step 7: Commit**

```
feat(token)!: remove TokenSigner, GenericSigner and old signer APIs

BREAKING: Remove TokenSigner, OwnTokenSigner, GenericSigner, OwnSigner
types. Remove getSigner, toTokenSigner, getTokenSigner, randomTokenSigner,
randomSigner functions. Use Identity types and factory functions instead.
```

---

### Task 13: Update Node keystore

**Files:**
- Modify: `packages/node-keystore/src/signer.ts` → rename to `packages/node-keystore/src/identity.ts`
- Modify: `packages/node-keystore/src/index.ts`

**Step 1: Replace signer.ts with identity.ts**

Create `packages/node-keystore/src/identity.ts`:

```typescript
import { createFullIdentity, type FullIdentity } from '@enkaku/token'

import { NodeKeyStore } from './store.js'

function getStore(store: NodeKeyStore | string): NodeKeyStore {
  return typeof store === 'string' ? NodeKeyStore.open(store) : store
}

export function provideFullIdentity(store: NodeKeyStore | string, keyID: string): FullIdentity {
  const key = getStore(store).entry(keyID).provide()
  return createFullIdentity(key)
}

export async function provideFullIdentityAsync(
  store: NodeKeyStore | string,
  keyID: string,
): Promise<FullIdentity> {
  const key = await getStore(store).entry(keyID).provideAsync()
  return createFullIdentity(key)
}
```

Delete `packages/node-keystore/src/signer.ts`.

**Step 2: Update barrel**

In `packages/node-keystore/src/index.ts` (line 14):
```typescript
export { provideFullIdentity, provideFullIdentityAsync } from './identity.js'
```

**Step 3: Run tests**

Run: `pnpm vitest run packages/node-keystore/test/`
Expected: PASS (or update tests if they reference old APIs)

**Step 4: Commit**

```
feat(node-keystore)!: replace provideTokenSigner with provideFullIdentity

BREAKING: Remove provideTokenSigner/provideTokenSignerAsync.
Add provideFullIdentity/provideFullIdentityAsync returning FullIdentity.
```

---

### Task 14: Update Electron keystore

**Files:**
- Modify: `packages/electron-keystore/src/signer.ts` → rename to `packages/electron-keystore/src/identity.ts`
- Modify: `packages/electron-keystore/src/index.ts`

Same pattern as Task 13 but using `ElectronKeyStore`. Replace `getTokenSigner` with `createFullIdentity`. Delete old signer.ts, update barrel.

**Commit:**

```
feat(electron-keystore)!: replace provideTokenSigner with provideFullIdentity

BREAKING: Remove provideTokenSigner/provideTokenSignerAsync.
Add provideFullIdentity/provideFullIdentityAsync returning FullIdentity.
```

---

### Task 15: Update Expo keystore

**Files:**
- Modify: `packages/expo-keystore/src/signer.ts` → rename to `packages/expo-keystore/src/identity.ts`
- Modify: `packages/expo-keystore/src/index.ts`

Same pattern as Task 13 but using `ExpoKeyStore` (singleton, no store parameter). Delete old signer.ts, update barrel.

**Commit:**

```
feat(expo-keystore)!: replace provideTokenSigner with provideFullIdentity

BREAKING: Remove provideTokenSigner/provideTokenSignerAsync.
Add provideFullIdentity/provideFullIdentityAsync returning FullIdentity.
```

---

### Task 16: Update Browser keystore

**Files:**
- Modify: `packages/browser-keystore/src/signer.ts` → rename to `packages/browser-keystore/src/identity.ts`
- Modify: `packages/browser-keystore/src/utils.ts`
- Modify: `packages/browser-keystore/src/index.ts`

**Step 1: Update utils.ts**

Remove `getSigner` export. Update `randomKeyPair` to generate keys with ECDH usages:

```typescript
export async function randomKeyPair(): Promise<CryptoKeyPair> {
  return await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify', 'deriveBits', 'deriveKey'],
  )
}
```

Note: Web Crypto may not allow `deriveBits` with ECDSA algorithm. The key might need to be generated as ECDH + ECDSA, or a separate ECDH key pair derived. Research the correct Web Crypto approach -- you may need to generate an ECDH key pair separately or use the same underlying key with different algorithm parameters. This needs careful implementation and testing.

**Step 2: Create identity.ts**

Create `packages/browser-keystore/src/identity.ts` that builds a `FullIdentity` from a `CryptoKeyPair`, implementing both `signToken` (via ECDSA) and `decrypt`/`agreeKey` (via ECDH `deriveBits`).

**Step 3: Update barrel**

Remove `getSigner` and `provideTokenSigner` exports. Add `provideFullIdentity`.

**Step 4: Run tests**

Run: `pnpm vitest run packages/browser-keystore/test/`
Expected: PASS

**Step 5: Commit**

```
feat(browser-keystore)!: replace provideTokenSigner with provideFullIdentity

BREAKING: Remove provideTokenSigner and getSigner exports.
Add provideFullIdentity returning Promise<FullIdentity>.
Update key generation to include deriveBits usage for ECDH.
```

---

## Phase 5: Protocol and Access Control

### Task 17: Add EncryptionPolicy and update ProcedureAccessRecord

**Files:**
- Modify: `packages/server/src/access-control.ts:4`
- Test: existing access-control tests + new encryption policy tests

**Step 1: Write the failing test**

Add to `packages/server/test/access-control.test.ts`:

```typescript
import type { ProcedureAccessConfig } from '../src/access-control.js'

describe('ProcedureAccessConfig with encryption', () => {
  test('ProcedureAccessConfig type accepts encryption policy', () => {
    const config: ProcedureAccessConfig = {
      allow: true,
      encryption: 'required',
    }
    expect(config.encryption).toBe('required')
  })
})
```

**Step 2: Implement type changes**

In `packages/server/src/access-control.ts`:

```typescript
export type EncryptionPolicy = 'required' | 'optional' | 'none'

export type ProcedureAccessConfig = {
  allow?: boolean | Array<string>
  encryption?: EncryptionPolicy
}

export type ProcedureAccessValue = boolean | Array<string> | ProcedureAccessConfig

export type ProcedureAccessRecord = Record<string, ProcedureAccessValue>
```

Update `checkProcedureAccess` to handle the new union type -- when `access` is a `ProcedureAccessConfig`, extract the `allow` field.

**Step 3: Run tests**

Run: `pnpm vitest run packages/server/test/`
Expected: PASS

**Step 4: Commit**

```
feat(server): add EncryptionPolicy and extended ProcedureAccessRecord

Add EncryptionPolicy type ('required' | 'optional' | 'none').
Extend ProcedureAccessRecord to support ProcedureAccessConfig objects
with per-procedure encryption policy alongside existing allow rules.
```

---

### Task 18: Add server encryption policy enforcement

**Files:**
- Modify: `packages/server/src/server.ts` (add encryptionPolicy and responseEnvelopeMode params)
- Test: `packages/server/test/encryption-policy.test.ts`

**Step 1: Write the failing test**

Create `packages/server/test/encryption-policy.test.ts` testing that a server with `encryptionPolicy: 'required'` rejects unencrypted messages.

**Step 2: Add encryptionPolicy to ServerParams**

Add `encryptionPolicy?: EncryptionPolicy` and `responseEnvelopeMode?: EnvelopeMode` to `ServerParams`.

**Step 3: Implement policy checking in the message processing pipeline**

This task focuses on the boundary unwrap design -- detecting encrypted messages at the server boundary and enforcing the policy. The actual decryption will use the `unwrapEnvelope` function from `@enkaku/token`.

**Step 4: Run tests**

Run: `pnpm vitest run packages/server/test/`
Expected: PASS

**Step 5: Commit**

```
feat(server): add encryption policy enforcement

Add encryptionPolicy and responseEnvelopeMode to ServerParams.
Reject unencrypted messages when policy is 'required'.
```

---

## Phase 6: E2E Tests and Documentation

### Task 19: Update E2E tests

**Files:**
- Modify: `tests/e2e-web/src/App.tsx`
- Modify: `tests/e2e-expo/App.tsx`
- Modify: `tests/e2e-electron/src/main.ts`

Update all E2E test files to use the new identity APIs:
- `provideTokenSigner` → `provideFullIdentity`
- `provideTokenSignerAsync` → `provideFullIdentityAsync`
- `signer` → `identity`

**Commit:**

```
feat(e2e): update E2E tests to use identity APIs
```

---

### Task 20: Update documentation

**Files:**
- Modify: `docs/skills/auth.skill.md`
- Modify: `docs/capabilities/domains/authentication.md`
- Modify: `docs/capabilities/use-cases/securing-endpoints.md`

Replace all references to old APIs with new identity-based APIs. Update code examples.

**Commit:**

```
docs: update auth documentation for identity API migration
```

---

### Task 21: Full test suite validation

**Step 1: Run full build**

Run: `pnpm run build`
Expected: PASS (no type errors)

**Step 2: Run full test suite**

Run: `pnpm run test`
Expected: PASS (all packages)

**Step 3: Run linter**

Run: `pnpm run lint`
Expected: PASS

**Step 4: Commit any fixes**

If any issues found, fix and commit.

---

## Phase 7: Multi-recipient JWE utilities (token package)

### Task 22: Add ECDH-ES+A256KW key wrapping

**Files:**
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/test/jwe.test.ts`

Add AES-256-KW key wrap/unwrap functions and the `ECDH-ES+A256KW` algorithm variant for `TokenEncrypter.encryptMulti()`.

**Commit:**

```
feat(token): add ECDH-ES+A256KW key wrapping for multi-recipient JWE
```

---

### Task 23: Add JWE JSON serialization for multiple recipients

**Files:**
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/test/jwe.test.ts`

Implement `TokenEncrypter.encryptMulti()` producing `JWEJSONSerialization` with per-recipient wrapped CEKs.

**Commit:**

```
feat(token): add JWE JSON serialization for multi-recipient encryption
```
