# JWE Message-Level Encryption Design

> Design for adding JWE (JSON Web Encryption) support to the Enkaku RPC protocol, client, and server.

## Goals

1. **End-to-end encryption** -- Payload confidentiality beyond transport TLS. Intermediaries (proxies, load balancers, log systems) cannot read RPC payloads.
2. **Multi-party confidentiality** -- Messages routable by intermediaries that cannot see content. Selective recipient targeting.
3. **Encrypted-at-rest** -- Persisted messages (logs, queues, databases) remain encrypted without the recipient's key.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Key agreement | X25519 (Ed25519 keystores) + P-256 ECDH (browser keystore) | Matches existing key types per platform |
| Decryption | Algorithm-agnostic, dispatch from JWE header | Single decryption path handles either `alg` |
| Envelope modes | `plain`, `jws`, `jws-in-jwe`, `jwe-in-jws` | Protocol supports all four; consumers choose per threat model |
| Wire format | JWE Compact Serialization (single recipient) | Protocol messages target one recipient |
| Multi-recipient | JWE JSON Serialization via token utilities | `@enkaku/token` exposes multi-recipient utilities for consumers |
| ECDH-ES variants | `ECDH-ES` direct (compact) + `ECDH-ES+A256KW` (JSON/multi) | Direct for protocol simplicity, key wrapping for multi-recipient |
| Content encryption | A256GCM only | Fast, authenticated, Web Crypto native, `@noble/ciphers` for Node |
| Key discovery | DID-derived by default, explicit override | Leverages existing DID infrastructure, escape hatch for key separation |
| Encrypter caching | `TokenEncrypter` caches parsed recipient public key | Avoid re-deriving from DID on every call |
| API surface | Default config + per-call overrides | Consistent with existing signing pattern |
| Identity types | All in `@enkaku/token` | Avoids circular dependency with a separate identity package |
| Breaking changes | Clean cut, no deprecated APIs | Remove `TokenSigner`, `provideTokenSigner()` entirely |
| Encryption direction | Independently configurable per direction | Client-to-server and server-to-client encryption are separate concerns |
| Server signing | Supported via `SigningIdentity` on server | Server can sign responses using same identity hierarchy |

---

## Type Hierarchy

All types live in `@enkaku/token`.

```typescript
// Base - DID holder
type Identity = { readonly id: string }

// Signing capability
type SigningIdentity = Identity & {
  signToken(
    payload: Record<string, unknown>,
    header?: Record<string, unknown>,
  ): Promise<SignedToken>
}

// Decryption capability (high-level + composable)
type DecryptingIdentity = Identity & {
  decrypt(jwe: string): Promise<Uint8Array>
  agreeKey(ephemeralPublicKey: Uint8Array): Promise<Uint8Array>
}

// Full bundle
type FullIdentity = SigningIdentity & DecryptingIdentity

// With private key access (for key generation / test utilities)
type OwnIdentity = FullIdentity & { privateKey: Uint8Array }

// Type guards
function isSigningIdentity(identity: Identity): identity is SigningIdentity
function isDecryptingIdentity(identity: Identity): identity is DecryptingIdentity
function isFullIdentity(identity: Identity): identity is FullIdentity
```

### Factory Functions

```typescript
// From raw private key bytes (Ed25519) or Web Crypto key pair (P-256)
function createSigningIdentity(privateKey: Uint8Array | CryptoKeyPair): SigningIdentity
function createDecryptingIdentity(privateKey: Uint8Array | CryptoKeyPair): DecryptingIdentity
function createFullIdentity(privateKey: Uint8Array | CryptoKeyPair): FullIdentity

// From keystore entry
function provideFullIdentity(entry: KeyEntry): Promise<FullIdentity>

// Generate a random identity (exposes private key for storage/export)
function randomIdentity(): OwnIdentity
```

### Removed Types

The following low-level types are removed from the public API:

- `TokenSigner` -- replaced by `SigningIdentity`
- `OwnTokenSigner` -- replaced by `OwnIdentity`
- `GenericSigner` -- removed (internal implementation detail of identity factories)
- `OwnSigner` -- removed (replaced by `OwnIdentity` for private key access)

### TokenEncrypter (separate from identity hierarchy)

Encryption targets a recipient's public key -- it's not a property of your own identity.

```typescript
type TokenEncrypter = {
  readonly recipientID: string
  encrypt(payload: Uint8Array, options?: EncryptOptions): Promise<string>
  encryptMulti(
    payload: Uint8Array,
    additionalRecipients: Array<string>,
  ): Promise<JWEJSONSerialization>
}

type EncryptOptions = {
  algorithm?: 'ECDH-ES' | 'ECDH-ES+A256KW'
}

// Factory - caches parsed public key internally
function createTokenEncrypter(
  recipient: string | Uint8Array,
  options?: { algorithm?: 'X25519' | 'P-256' },
): TokenEncrypter
```

---

## Envelope Modes

```typescript
type EnvelopeMode = 'plain' | 'jws' | 'jws-in-jwe' | 'jwe-in-jws'
```

| Mode | Wire format | Processing order | Use case |
|------|------------|-----------------|----------|
| `plain` | Unsigned token (`alg: 'none'`) | Direct parse | Public, trusted transport |
| `jws` | Signed token | Verify signature | Authentication without confidentiality |
| `jws-in-jwe` | JWE wrapping a JWS | Decrypt -> verify | Full privacy: signer identity hidden |
| `jwe-in-jws` | JWS wrapping a JWE | Verify -> decrypt | Routable: intermediaries authenticate sender |

### Token Operations

```typescript
function encryptToken(
  encrypter: TokenEncrypter,
  token: string | Uint8Array,
  options?: EncryptOptions,
): Promise<string>

function decryptToken(
  decrypter: DecryptingIdentity,
  jwe: string,
): Promise<Uint8Array>

function wrapEnvelope(
  mode: EnvelopeMode,
  payload: Record<string, unknown>,
  options: {
    signer?: SigningIdentity
    encrypter?: TokenEncrypter
    header?: Record<string, unknown>
  },
): Promise<string>

type UnwrappedEnvelope = {
  payload: Record<string, unknown>
  mode: EnvelopeMode
}

function unwrapEnvelope(
  message: string,
  options: {
    decrypter?: DecryptingIdentity
    verifiers?: TokenVerifiers
  },
): Promise<UnwrappedEnvelope>
```

---

## JWE Format

### JWE Header

```typescript
type JWEHeader = {
  alg: 'ECDH-ES' | 'ECDH-ES+A256KW'
  enc: 'A256GCM'
  epk: JSONWebKey
  kid?: string
  apu?: string
  apv?: string
}
```

### Compact Serialization (protocol messages)

```
BASE64URL(header).BASE64URL(encryptedKey).BASE64URL(iv).BASE64URL(ciphertext).BASE64URL(tag)
```

For `ECDH-ES` direct, the `encryptedKey` component is empty (the ECDH-derived key is the CEK directly).

### JSON Serialization (multi-recipient utilities)

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
```

---

## Crypto Implementation

### Dependencies

- `@noble/curves` -- existing. Ed25519/P-256 signing, X25519 ECDH, Ed25519->X25519 conversion.
- `@noble/ciphers` -- new. AES-256-GCM and AES-256-KW for Node/Electron/Expo.
- Web Crypto API -- browser path for ECDH (P-256) and AES-256-GCM.

### Key Conversion (Ed25519 -> X25519)

```typescript
import { edwardsToMontgomeryPriv, edwardsToMontgomeryPub } from '@noble/curves/ed25519'

function deriveEncryptionKeyPair(ed25519PrivateKey: Uint8Array): {
  publicKey: Uint8Array   // X25519
  privateKey: Uint8Array  // X25519
}
```

P-256 keys need no conversion -- the same key pair is used for ECDSA signing and ECDH.

### ECDH-ES Key Agreement (RFC 7518 Section 4.6)

1. Sender generates ephemeral key pair on recipient's curve
2. ECDH: `sharedSecret = ECDH(ephemeralPrivate, recipientPublic)`
3. Derive symmetric key via Concat KDF
4. For `ECDH-ES`: derived key is the CEK (direct)
5. For `ECDH-ES+A256KW`: derived key wraps a random CEK via AES-256-KW
6. Ephemeral public key stored in JWE header as `epk`
7. Ephemeral private key discarded (forward secrecy)

### Concat KDF (RFC 7518 Section 4.6.2)

```typescript
type ConcatKDFParams = {
  sharedSecret: Uint8Array
  keyLength: number
  algorithmID: string
  partyUInfo: Uint8Array
  partyVInfo: Uint8Array
}

function concatKDF(params: ConcatKDFParams): Uint8Array
```

Single SHA-256 iteration (256-bit key fits in one hash block).

### AES-256-GCM

- 12-byte random IV per encryption
- 128-bit authentication tag
- Node/Electron/Expo: `@noble/ciphers` `gcm()`
- Browser: `crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)`

### AES-256-KW (multi-recipient only)

```typescript
function aesKeyWrap(kek: Uint8Array, cek: Uint8Array): Uint8Array
function aesKeyUnwrap(kek: Uint8Array, wrapped: Uint8Array): Uint8Array
```

### Platform Crypto Provider

```typescript
type CryptoProvider = {
  generateEphemeralKeyPair(curve: 'X25519' | 'P-256'): Promise<KeyPair>
  ecdh(
    privateKey: Uint8Array | CryptoKey,
    publicKey: Uint8Array | CryptoKey,
    curve: 'X25519' | 'P-256',
  ): Promise<Uint8Array>
  encrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<EncryptionResult>
  decrypt(
    key: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array,
    tag: Uint8Array,
  ): Promise<Uint8Array>
}
```

Two implementations: `@noble/curves` + `@noble/ciphers` (Node/Electron/Expo) and Web Crypto (browser).

---

## Protocol & Access Control Changes

### EncryptionPolicy

```typescript
type EncryptionPolicy = 'required' | 'optional' | 'none'
```

### Extended ProcedureAccessRecord

```typescript
type ProcedureAccessConfig = {
  allow?: boolean | Array<string>
  encryption?: EncryptionPolicy
}

type ProcedureAccessValue = boolean | Array<string> | ProcedureAccessConfig

type ProcedureAccessRecord = Record<string, ProcedureAccessValue>
```

When the value is `boolean` or `Array<string>`, encryption defaults to the server-level `encryptionPolicy`. When it's `ProcedureAccessConfig`, the `encryption` field overrides per-procedure.

---

## Client & Server API Changes

### Client

```typescript
type ClientParams = {
  // ...existing params (transport, protocol, serverID)
  identity?: Identity          // replaces signer?: TokenSigner
  envelopeMode?: EnvelopeMode
  encrypter?: TokenEncrypter
}
```

Per-call override:

```typescript
client.request('myProcedure', params, {
  encryption: { mode: 'jws-in-jwe' },
})
```

### Server

```typescript
type ServerParams = {
  // ...existing params (protocol, public, access, handlers)
  identity?: Identity          // replaces id?: string
  encryptionPolicy?: EncryptionPolicy
  responseEnvelopeMode?: EnvelopeMode
}
```

### Server Message Processing Pipeline

1. Receive message from transport
2. Detect envelope mode from token structure (JWE header / JWS header / `alg: 'none'`)
3. If encrypted outer layer: assert `isDecryptingIdentity(identity)`, decrypt
4. If signed (outer or inner): verify signature
5. If encrypted inner layer (for `jwe-in-jws`): decrypt
6. Check encryption policy: if `required` and message was not encrypted, reject with `ENCRYPTION_REQUIRED`
7. Schema validation and dispatch (existing flow)

For responses, if `responseEnvelopeMode` is set and `isSigningIdentity(identity)` / encrypter is available, wrap the response accordingly. The server creates a `TokenEncrypter` per client DID (cached) to encrypt responses back.

---

## Keystore Changes

### Browser Keystore

Update key generation to include ECDH usages:

```typescript
const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign', 'verify', 'deriveBits', 'deriveKey'],
)
```

Existing keys with only `sign`/`verify` usages cannot perform ECDH. Old keys must be regenerated.

### Keystore API Replacements

Each keystore preserves its existing sync/async pattern:

| Package | Removals | Additions |
|---------|----------|-----------|
| `@enkaku/node-keystore` | `provideTokenSigner()`, `provideTokenSignerAsync()` | `provideFullIdentity()` (sync, lazy), `provideFullIdentityAsync()` (async, eager) |
| `@enkaku/electron-keystore` | `provideTokenSigner()`, `provideTokenSignerAsync()` | `provideFullIdentity()` (sync, lazy), `provideFullIdentityAsync()` (async, eager) |
| `@enkaku/expo-keystore` | `provideTokenSigner()`, `provideTokenSignerAsync()` | `provideFullIdentity()` (sync, lazy), `provideFullIdentityAsync()` (async, eager) |
| `@enkaku/browser-keystore` | `provideTokenSigner()`, `getSigner()` | `provideFullIdentity()` (async only, returns `Promise<FullIdentity>`) |

### All Package Changes

| Package | Removals | Additions |
|---------|----------|-----------|
| `@enkaku/token` | `TokenSigner`, `OwnTokenSigner`, `GenericSigner`, `OwnSigner`, `toTokenSigner()`, `getSigner()`, `getTokenSigner()`, `randomTokenSigner()`, `randomSigner()` | Identity types (`Identity`, `SigningIdentity`, `DecryptingIdentity`, `FullIdentity`, `OwnIdentity`), type guards, factory functions (`createSigningIdentity`, `createDecryptingIdentity`, `createFullIdentity`, `randomIdentity`), JWE operations (`encryptToken`, `decryptToken`, `wrapEnvelope`, `unwrapEnvelope`), `TokenEncrypter`, `EnvelopeMode`, `UnwrappedEnvelope` |
| `@enkaku/token` | `signToken(signer: TokenSigner, ...)` | `signToken(signer: SigningIdentity, ...)` (parameter type change) |
| `@enkaku/protocol` | -- | `EncryptionPolicy`, `ProcedureAccessConfig`, updated message schemas (JWE detection at boundary) |
| `@enkaku/client` | `signer` param | `identity`, `envelopeMode`, `encrypter` params |
| `@enkaku/server` | `id` param | `identity`, `encryptionPolicy`, `responseEnvelopeMode` params |
| `@enkaku/capability` | `createCapability(signer: TokenSigner, ...)` | `createCapability(signer: SigningIdentity, ...)` (parameter type change) |
| `@enkaku/standalone` | `StandaloneOptions.signer` | `StandaloneOptions.identity` (derives server ID from `identity.id`, passes `identity` to both server and client) |
| `@enkaku/electron-rpc` | -- | Transitive change: `RendererClientOptions` extends `ClientParams`, so `signer` becomes `identity` automatically |

---

## Message Type & Boundary Unwrap

The `Message` type stays as-is:

```typescript
type Message<Payload extends Record<string, unknown>> =
  | SignedToken<SignedPayload & Payload>
  | UnsignedToken<Payload>
```

JWE wrapping/unwrapping happens at the client/server boundary, **not** in the type system:

- **Client outbound:** Creates a `Message` (signed or unsigned), then calls `wrapEnvelope()` to produce the wire format (opaque string for JWE modes, or the message object for plain/JWS modes).
- **Server inbound:** Receives from transport, detects envelope mode, calls `unwrapEnvelope()` to get the inner `Message`. From this point on, the existing processing pipeline handles it.
- **Server outbound / Client inbound:** Same pattern in reverse.

The transport layer carries either structured `Message` objects or opaque strings. The client/server layer is responsible for envelope logic. This avoids expanding the `Message` union type and keeps all encryption concerns out of the transport and handler layers.

### Protocol Schema Validation

`createMessageSchema()` in `@enkaku/protocol` currently generates JSON schemas for signed/unsigned message validation. With JWE:

- For `plain` and `jws` modes: existing schema validation applies (message is a structured object).
- For `jws-in-jwe` and `jwe-in-jws` modes: the server unwraps the envelope first, then validates the inner message against existing schemas.
- Schema validation always runs on the **unwrapped** message, never on the JWE envelope itself.

---

## Test Utility Changes

Test files extensively use `randomTokenSigner()` to create test identities. Replacements:

| Old | New |
|-----|-----|
| `randomTokenSigner()` | `randomIdentity()` -- returns `OwnIdentity` (includes `privateKey` for test assertions) |
| `signer.id` | `identity.id` |
| `signer.createToken(payload)` | `identity.signToken(payload)` |
| `getTokenSigner(privateKey)` | `createFullIdentity(privateKey)` |

### E2E Test Updates

| Test | Old API | New API |
|------|---------|---------|
| `tests/e2e-web/src/App.tsx` | `provideTokenSigner('test')` from `@enkaku/browser-keystore` | `provideFullIdentity('test')` |
| `tests/e2e-expo/App.tsx` | `provideTokenSigner('test')` from `@enkaku/expo-keystore` | `provideFullIdentity('test')` |
| `tests/e2e-electron/src/main.ts` | `provideTokenSignerAsync('EnkakuKeystore', keyID)` from `@enkaku/electron-keystore` | `provideFullIdentityAsync('EnkakuKeystore', keyID)` |

---

## Documentation Updates

The following documentation files reference old APIs and must be updated:

| File | APIs to update |
|------|---------------|
| `docs/skills/auth.skill.md` | `randomTokenSigner`, `provideTokenSignerAsync`, `provideTokenSigner`, `signer.createToken`, `signer.id` |
| `docs/capabilities/domains/authentication.md` | All keystore `provideTokenSigner`/`provideTokenSignerAsync` signatures, `getSigner`, `toTokenSigner` |
| `docs/capabilities/use-cases/securing-endpoints.md` | `provideTokenSignerAsync`, `provideTokenSigner` |

**Note:** `website/docs/api/` pages are auto-generated from source code and do not need manual edits.

### Downstream Impact

Kubun and Mokei depend on Enkaku and will need to update:
- `provideTokenSigner()` / `provideTokenSignerAsync()` calls -> `provideFullIdentity()` / `provideFullIdentityAsync()`
- `signer` params -> `identity`
- `id` params (server) -> `identity`
- `signer.id` references -> `identity.id`
- `signer.createToken()` calls -> `identity.signToken()`
