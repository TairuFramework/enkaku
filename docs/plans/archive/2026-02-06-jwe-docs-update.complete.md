# JWE Documentation Update Plan

**Status:** complete

**Goal:** Update all Enkaku documentation to reflect the JWE message encryption feature and the `TokenSigner` -> `Identity` API migration completed on the `feature/jwe-message-encryption` branch.

**Architecture:** Four files need updates: `authentication.md` (major -- fix incorrect API signature, add identity hierarchy, add JWE exports and patterns), `auth.skill.md` (moderate -- add encryption pattern), `architecture.md` and `discover.skill.md` (minor -- add encryption mentions). Six other doc files are already correct.

**Tech Stack:** Markdown documentation only, no code changes.

**Conventions:** `docs/agents/conventions.md` -- verify code samples use `type` not `interface`, `Array<T>` not `T[]`, never `any`, capital `ID`/`DID`/`JWT`, `.js` extensions in imports.

---

## Task 1: Update authentication domain reference

**Files:**
- Modify: `docs/capabilities/domains/authentication.md:15-27,37-67,649-691`

**Step 1: Fix @enkaku/token key exports list (lines 15-27)**

Replace the current "Key exports" section with:

```markdown
**Key exports**:
- `randomIdentity()` - Generate identity with random private key (returns `OwnIdentity`)
- `createSigningIdentity(privateKey)` - Create signing-only identity from Ed25519 key
- `createDecryptingIdentity(privateKey)` - Create decryption-only identity from Ed25519 key
- `createFullIdentity(privateKey)` - Create identity with signing + decryption from Ed25519 key
- `isSigningIdentity(identity)` / `isDecryptingIdentity(identity)` / `isFullIdentity(identity)` - Type guards
- `verifyToken(token)` - Verify token signature and return verified token
- `createUnsignedToken(payload)` - Create unsigned token object
- `signToken(identity, token)` - Sign an unsigned token
- `isSignedToken(token)` / `isUnsignedToken(token)` / `isVerifiedToken(token)` - Type guards
- `createTokenEncrypter(recipient)` - Create encrypter targeting a DID or public key
- `encryptToken(encrypter, plaintext)` / `decryptToken(decrypter, jwe)` - JWE encrypt/decrypt
- `wrapEnvelope(mode, payload, options)` / `unwrapEnvelope(message, options)` - Envelope operations
- `getDID(codec, publicKey)` - Create DID from public key
- `getSignatureInfo(did)` - Extract algorithm and public key from DID
- `randomPrivateKey()` - Generate random Ed25519 private key
- `encodePrivateKey(key)` / `decodePrivateKey(encoded)` - Base64 encode/decode
```

**Step 2: Update dependencies line (line 28)**

Change:

```markdown
**Dependencies**: `@enkaku/codec`, `@enkaku/schema`, `@noble/curves`
```

To:

```markdown
**Dependencies**: `@enkaku/codec`, `@enkaku/schema`, `@noble/curves`, `@noble/ciphers`
```

**Step 3: Update core concepts (lines 30-35)**

Replace:

```markdown
**Core concepts**:
- **DID format**: `did:key:z<base58-multicodec-pubkey>`
- **Supported algorithms**: EdDSA (Ed25519), ES256 (P-256)
- **Token structure**: `{ header, payload, signature, data }`
- **Verification**: Extract public key from DID in `iss` claim, verify signature
- **Capabilities**: Tokens can contain capability delegations in `cap` field
```

With:

```markdown
**Core concepts**:
- **DID format**: `did:key:z<base58-multicodec-pubkey>`
- **Supported algorithms**: EdDSA (Ed25519), ES256 (P-256)
- **Token structure**: `{ header, payload, signature, data }`
- **Verification**: Extract public key from DID in `iss` claim, verify signature
- **Capabilities**: Tokens can contain capability delegations in `cap` field
- **JWE encryption**: ECDH-ES (X25519) + A256GCM content encryption for message confidentiality
- **Envelope modes**: `plain`, `jws`, `jws-in-jwe`, `jwe-in-jws` for different security levels
```

**Step 4: Update type system section (lines 37-67)**

Replace with the full identity hierarchy:

```markdown
**Type system**:
```typescript
// Identity hierarchy (composable via intersection types)
type Identity = { readonly id: string }

type SigningIdentity = Identity & {
  signToken: <Payload, Header>(
    payload: Payload,
    header?: Header,
  ) => Promise<SignedToken<Payload, Header>>
}

type DecryptingIdentity = Identity & {
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array>
}

type FullIdentity = SigningIdentity & DecryptingIdentity

type OwnIdentity = FullIdentity & { privateKey: Uint8Array }

// Token encrypter (targets a recipient, not your own identity)
type TokenEncrypter = {
  recipientID?: string
  encrypt(plaintext: Uint8Array): Promise<string>
}

// Envelope modes
type EnvelopeMode = 'plain' | 'jws' | 'jws-in-jwe' | 'jwe-in-jws'

// Token types
type SignedToken<Payload, Header> = {
  data: string
  header: SignedHeader & Header
  payload: SignedPayload & Payload
  signature: string
}

type VerifiedToken<Payload, Header> = SignedToken<Payload, Header> & {
  verifiedPublicKey: Uint8Array
}

type SignedPayload = {
  iss: string
  sub?: string
  aud?: string
  cap?: string | Array<string>
  exp?: number
  nbf?: number
  iat?: number
}
```

**Step 5: Fix API Quick Reference @enkaku/token section (lines 649-691)**

Replace the entire @enkaku/token quick reference block:

```markdown
### @enkaku/token

```typescript
// Identity creation
function randomIdentity(): OwnIdentity
function createSigningIdentity(privateKey: Uint8Array): SigningIdentity
function createDecryptingIdentity(privateKey: Uint8Array): DecryptingIdentity
function createFullIdentity(privateKey: Uint8Array): FullIdentity

// Identity type guards
function isSigningIdentity(identity: Identity): identity is SigningIdentity
function isDecryptingIdentity(identity: Identity): identity is DecryptingIdentity
function isFullIdentity(identity: Identity): identity is FullIdentity

// Token operations
function verifyToken<Payload>(
  token: Token<Payload> | string,
  verifiers?: Verifiers
): Promise<Token<Payload>>

function createUnsignedToken<Payload, Header>(
  payload: Payload,
  header?: Header
): UnsignedToken<Payload, Header>

function signToken<Payload, Header>(
  identity: SigningIdentity,
  token: Token<Payload, Header>
): Promise<SignedToken<Payload, Header>>

// Token type guards
function isSignedToken(token: unknown): token is SignedToken
function isUnsignedToken(token: Token): token is UnsignedToken
function isVerifiedToken(token: unknown): token is VerifiedToken

// JWE encryption
function createTokenEncrypter(recipient: string): TokenEncrypter
function createTokenEncrypter(recipient: Uint8Array, options: EncryptOptions): TokenEncrypter
function encryptToken(encrypter: TokenEncrypter, plaintext: Uint8Array): Promise<string>
function decryptToken(decrypter: DecryptingIdentity, jwe: string): Promise<Uint8Array>

// Envelope wrapping
function wrapEnvelope(
  mode: EnvelopeMode,
  payload: Record<string, unknown>,
  options: WrapOptions,
): Promise<string>

function unwrapEnvelope(
  message: string,
  options: UnwrapOptions,
): Promise<UnwrappedEnvelope>

// Key operations
function randomPrivateKey(): Uint8Array
function encodePrivateKey(key: Uint8Array): string
function decodePrivateKey(encoded: string): Uint8Array

// DID operations
function getDID(codec: Uint8Array, publicKey: Uint8Array): string
function getSignatureInfo(did: string): [SignatureAlgorithm, Uint8Array]

// Utilities
function stringifyToken(token: SignedToken): string
```

**Step 6: Verify no other stale references remain**

Search for `GenericSigner`, `OwnSigner`, `TokenSigner`, `randomTokenSigner`, `getTokenSigner`, `getSigner`, `toTokenSigner`, `provideTokenSigner` in the file. There should be zero matches after the changes.

**Step 7: Commit**

```
docs(auth): update authentication reference for identity types and JWE

Fix incorrect createSigningIdentity signature (was GenericSigner, now
Uint8Array). Add full identity type hierarchy, JWE encryption exports,
TokenEncrypter type, and EnvelopeMode to type system and API reference.
```

---

## Task 2: Add JWE encryption pattern to auth skill

**Files:**
- Modify: `docs/skills/auth.skill.md`

**Step 1: Add Pattern 6 for JWE encryption after Pattern 5 (after line 243)**

Insert before the "When to Use What" section:

```markdown
### Pattern 6: Message-Level Encryption with JWE

```typescript
import {
  createTokenEncrypter,
  encryptToken,
  decryptToken,
  wrapEnvelope,
  unwrapEnvelope,
  randomIdentity,
} from '@enkaku/token'

// Sender and recipient identities
const sender = randomIdentity()
const recipient = randomIdentity()

// Create encrypter targeting recipient's DID
const encrypter = createTokenEncrypter(recipient.id)

// Low-level: Encrypt raw bytes
const plaintext = new TextEncoder().encode('secret message')
const jwe = await encryptToken(encrypter, plaintext)
// jwe is a JWE compact serialization string (5 dot-separated parts)

const decrypted = await decryptToken(recipient, jwe)
new TextDecoder().decode(decrypted) // 'secret message'

// High-level: Envelope wrapping (combines signing + encryption)
// jws-in-jwe: sign then encrypt (hides sender identity)
const wrapped = await wrapEnvelope('jws-in-jwe', { typ: 'request', prc: 'secret', rid: '1', prm: {} }, {
  signer: sender,
  encrypter,
})

const { payload, mode } = await unwrapEnvelope(wrapped, { decrypter: recipient })
console.log(mode) // 'jws-in-jwe'
console.log(payload.prc) // 'secret'
```

**Use case**: End-to-end encryption where intermediaries (proxies, logs) cannot read payloads

**Key points**:
- Uses ECDH-ES (X25519) key agreement with A256GCM content encryption
- `createTokenEncrypter` accepts a DID string or raw X25519 public key
- JWE compact serialization: `header.encryptedKey.iv.ciphertext.tag`
- For ECDH-ES direct, the encrypted key segment is empty (key derived directly)
- Fresh ephemeral key pair per encryption (forward secrecy)
- Four envelope modes: `plain`, `jws`, `jws-in-jwe`, `jwe-in-jws`
- `jws-in-jwe` hides sender identity; `jwe-in-jws` allows routing by sender
- Ed25519 keys are auto-converted to X25519 for ECDH
```

**Step 2: Update "When to Use What" for @enkaku/token**

In the existing "When to Use What" section, add these bullets to the `@enkaku/token` block:

```markdown
- Need to encrypt RPC payloads beyond transport-level TLS
- Working with envelope modes (plain, jws, jws-in-jwe, jwe-in-jws)
```

**Step 3: Verify code sample correctness**

Check that `createTokenEncrypter(recipient.id)` (string overload) and `decryptToken(recipient, jwe)` (DecryptingIdentity) match actual API from `packages/token/src/jwe.ts`.

**Step 4: Commit**

```
docs(auth-skill): add JWE encryption pattern and envelope modes

Add Pattern 6 demonstrating message-level encryption with
createTokenEncrypter, encryptToken/decryptToken, and envelope
wrapping. Update "When to Use What" with encryption guidance.
```

---

## Task 3: Update architecture and discover docs

**Files:**
- Modify: `docs/agents/architecture.md:18-19`
- Modify: `docs/skills/discover.skill.md:17-18`

**Step 1: Update architecture.md auth description (line 18-19)**

Replace:

```markdown
**Authentication & Security**: Built-in token system provides JWT-like authentication with signing and verification. Keystore abstractions enable secure key management across different environments (Node.js, browser, React Native). Access control is enforced at the procedure level.
```

With:

```markdown
**Authentication & Security**: Built-in token system provides JWT-like authentication with signing and verification, plus JWE message-level encryption using ECDH-ES key agreement and A256GCM. Keystore abstractions enable secure key management across different environments (Node.js, browser, React Native, Electron). Access control and encryption policy are enforced at the procedure level.
```

**Step 2: Update architecture.md token package description (line 92)**

Replace:

```markdown
- **token**: JWT-like token system for authentication
```

With:

```markdown
- **token**: JWT-like token system for authentication and JWE message encryption
```

**Step 3: Update discover.skill.md auth description (lines 17-18)**

Replace:

```markdown
- **Authentication & Security** - Tokens, keystores, access control
  Secure your RPC endpoints with Enkaku's token system and keystore abstractions. The framework provides JWT-like tokens with signing and verification, plus keystore implementations for different environments (Node.js, browser, React Native). The keystore system supports various backends including in-memory storage, file-based persistence, and cloud key management services. Use `/enkaku:auth` to learn about authentication patterns, token validation, access control strategies, and how to choose the right keystore implementation for your security requirements.
```

With:

```markdown
- **Authentication & Security** - Tokens, keystores, encryption, access control
  Secure your RPC endpoints with Enkaku's token system, keystore abstractions, and JWE message-level encryption. The framework provides JWT-like tokens with signing and verification, ECDH-ES encryption with envelope modes (plain, jws, jws-in-jwe, jwe-in-jws), and keystore implementations for different environments (Node.js, browser, React Native, Electron). Use `/enkaku:auth` to learn about authentication patterns, token validation, encryption, access control strategies, and how to choose the right keystore implementation for your security requirements.
```

**Step 4: Commit**

```
docs: add JWE encryption mentions to architecture and discovery docs

Update auth descriptions in architecture.md and discover.skill.md
to reflect JWE message-level encryption, ECDH-ES key agreement,
envelope modes, and Electron keystore support.
```

---

## Task 4: Verify all docs and final commit

**Step 1: Search for stale API references across all docs**

Run grep for these patterns across `docs/`:
- `TokenSigner` -- should have zero matches
- `randomTokenSigner` -- should have zero matches
- `provideTokenSigner` -- should have zero matches
- `getTokenSigner` -- should have zero matches
- `GenericSigner` -- should have zero matches
- `OwnSigner` -- should have zero matches
- `getSigner` -- should have zero matches (except browser-keystore context)
- `signer` as a param name (check context -- `signer` is valid as a variable name in capability context, but `signer?: TokenSigner` patterns should be gone)

**Step 2: Review updated files for consistency**

Read each modified file end-to-end and verify:
- Code samples use current API (`identity.signToken`, not `signer.createToken`)
- Import paths use `.js` extensions
- Types use `type` not `interface`
- Arrays use `Array<T>` not `T[]`
- Identity uses capital `ID`/`DID`

**Step 3: Commit any fixes**

If any issues found, fix and commit.
