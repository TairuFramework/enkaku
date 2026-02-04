# JWE Multi-Recipient Encryption

**Extracted from:** `docs/plans/archive/2026-01-30-jwe-implementation-plan.partial.md` (Phase 7, Tasks 22-23)

**Priority:** Low -- single-recipient JWE (ECDH-ES direct + A256GCM) is already implemented. Multi-recipient adds `ECDH-ES+A256KW` key wrapping and JWE JSON Serialization for scenarios where a message must be decryptable by multiple parties.

---

## Task 22: Add ECDH-ES+A256KW key wrapping

**Files:**
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/test/jwe.test.ts`

Add AES-256-KW key wrap/unwrap functions (`aesKeyWrap`, `aesKeyUnwrap`) and the `ECDH-ES+A256KW` algorithm variant. In this mode, ECDH derives a key-encryption key (KEK) via Concat KDF, then wraps a random content-encryption key (CEK) using AES-256-KW. The wrapped CEK is placed in the `encrypted_key` component of the JWE.

**Dependencies:** `@noble/ciphers` already provides AES key wrap utilities.

**Design reference:**

```typescript
function aesKeyWrap(kek: Uint8Array, cek: Uint8Array): Uint8Array
function aesKeyUnwrap(kek: Uint8Array, wrapped: Uint8Array): Uint8Array
```

For `ECDH-ES+A256KW`, the Concat KDF `algorithmID` is `'A256KW'` (not `'A256GCM'`), and the derived key wraps a random 256-bit CEK.

---

## Task 23: Add JWE JSON Serialization for multiple recipients

**Files:**
- Modify: `packages/token/src/jwe.ts`
- Modify: `packages/token/test/jwe.test.ts`

Implement `TokenEncrypter.encryptMulti()` producing `JWEJSONSerialization` with per-recipient wrapped CEKs. Each recipient gets their own ephemeral ECDH key pair and wrapped CEK.

**Design reference:**

```typescript
type JWEJSONSerialization = {
  protected: string
  iv: string
  ciphertext: string
  tag: string
  recipients: Array<{
    header: { kid?: string; epk: JSONWebKey }
    encrypted_key: string
  }>
}

// On TokenEncrypter:
encryptMulti(
  payload: Uint8Array,
  additionalRecipients: Array<string>,
): Promise<JWEJSONSerialization>
```

The `JWEJSONSerialization` type is already defined in `packages/token/src/jwe.ts` but `encryptMulti` is not yet implemented.

---

## Context

The existing JWE implementation uses ECDH-ES direct key agreement (X25519) with AES-256-GCM and JWE Compact Serialization. This covers the primary protocol use case where messages target a single recipient. Multi-recipient support is a utility for consumers who need to encrypt a single message for multiple parties (e.g., group messaging, audit logging with escrow keys).
