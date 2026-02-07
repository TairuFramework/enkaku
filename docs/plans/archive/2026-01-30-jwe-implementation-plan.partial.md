# JWE Message-Level Encryption

**Status:** partial -- Phases 1-6 (Tasks 1-21) complete. Phase 7 (Tasks 22-23: multi-recipient JWE) deferred to backlog.

**Remaining work:** `docs/plans/backlog/2026-01-30-jwe-multi-recipient.md`

**Branch:** `feature/jwe-message-encryption`

---

## Goals

1. **End-to-end encryption** -- Payload confidentiality beyond transport TLS. Intermediaries cannot read RPC payloads.
2. **Multi-party confidentiality** -- Messages routable by intermediaries that cannot see content.
3. **Encrypted-at-rest** -- Persisted messages remain encrypted without the recipient's key.

---

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
| Identity types | All in `@enkaku/token` | Avoids circular dependency with a separate identity package |
| Breaking changes | Clean cut, no deprecated APIs | Remove `TokenSigner`, `provideTokenSigner()` entirely |
| Encryption direction | Independently configurable per direction | Client-to-server and server-to-client encryption are separate concerns |
| Server signing | Supported via `SigningIdentity` on server | Server can sign responses using same identity hierarchy |

---

## What Was Built

### Identity type hierarchy (`@enkaku/token`)

Replaced `TokenSigner` with a composable identity type hierarchy:

```typescript
type Identity = { readonly id: string }
type SigningIdentity = Identity & { signToken(...): Promise<SignedToken> }
type DecryptingIdentity = Identity & { decrypt(jwe: string): Promise<Uint8Array>; agreeKey(epk: Uint8Array): Promise<Uint8Array> }
type FullIdentity = SigningIdentity & DecryptingIdentity
type OwnIdentity = FullIdentity & { privateKey: Uint8Array }
```

Factory functions: `createSigningIdentity`, `createDecryptingIdentity`, `createFullIdentity`, `randomIdentity`

Type guards: `isSigningIdentity`, `isDecryptingIdentity`, `isFullIdentity`

### JWE crypto primitives (`@enkaku/token`)

- **Concat KDF** (RFC 7518 Section 4.6.2) with SHA-256 -- single iteration for 256-bit keys
- **ECDH-ES direct** key agreement (X25519) + **AES-256-GCM** content encryption (12-byte random IV, 128-bit auth tag)
- **TokenEncrypter** factory with DID-based recipient key resolution and cached public key
- **Envelope wrapping/unwrapping** for all four modes (`plain`, `jws`, `jws-in-jwe`, `jwe-in-jws`)
- Dependencies: `@noble/curves` (existing), `@noble/ciphers` (new)

Key conversion: Ed25519 -> X25519 via `edwardsToMontgomeryPriv`/`edwardsToMontgomeryPub` from `@noble/curves/ed25519`. P-256 keys need no conversion (same key for ECDSA + ECDH).

### Envelope modes

| Mode | Wire format | Processing order | Use case |
|------|------------|-----------------|----------|
| `plain` | Unsigned token (`alg: 'none'`) | Direct parse | Public, trusted transport |
| `jws` | Signed token | Verify signature | Authentication without confidentiality |
| `jws-in-jwe` | JWE wrapping a JWS | Decrypt -> verify | Full privacy: signer identity hidden |
| `jwe-in-jws` | JWS wrapping a JWE | Verify -> decrypt | Routable: intermediaries authenticate sender |

### JWE wire format

Compact serialization (protocol messages): `BASE64URL(header).BASE64URL(encryptedKey).BASE64URL(iv).BASE64URL(ciphertext).BASE64URL(tag)`. For ECDH-ES direct, the `encryptedKey` component is empty.

JWE header: `{ alg: 'ECDH-ES' | 'ECDH-ES+A256KW', enc: 'A256GCM', epk: JSONWebKey, kid?, apu?, apv? }`

### TokenEncrypter

Encryption targets a recipient's public key (separate from the sender's identity):

```typescript
type TokenEncrypter = {
  readonly recipientID: string
  encrypt(payload: Uint8Array, options?: EncryptOptions): Promise<string>
}

function createTokenEncrypter(recipient: string | Uint8Array, options?: { algorithm?: 'X25519' | 'P-256' }): TokenEncrypter
```

### Consumer migrations

All packages updated from `TokenSigner`/`signer` to `Identity`/`identity`:

| Package | Old API | New API |
|---------|---------|---------|
| `@enkaku/capability` | `createCapability(signer: TokenSigner)` | `createCapability(signer: SigningIdentity)` |
| `@enkaku/client` | `signer?: TokenSigner` | `identity?: Identity` |
| `@enkaku/server` | `id?: string` | `identity?: Identity` |
| `@enkaku/standalone` | `signer?: TokenSigner` | `identity?: Identity` |
| `@enkaku/node-keystore` | `provideTokenSigner()` | `provideFullIdentity()` / `provideFullIdentityAsync()` |
| `@enkaku/electron-keystore` | `provideTokenSigner()` | `provideFullIdentity()` / `provideFullIdentityAsync()` |
| `@enkaku/expo-keystore` | `provideTokenSigner()` | `provideFullIdentity()` / `provideFullIdentityAsync()` |
| `@enkaku/browser-keystore` | `provideTokenSigner()` | `provideSigningIdentity()` (P-256 ECDSA only, no decryption) |

### Encryption policy enforcement (`@enkaku/server`)

- `EncryptionPolicy` type: `'required' | 'optional' | 'none'`
- `ProcedureAccessConfig` with per-procedure encryption overrides
- Server rejects unencrypted messages when policy is `'required'` (error code `EK07`)
- Works for both public and non-public servers

### Server message processing pipeline

1. Receive message from transport
2. Detect envelope mode from token structure (JWE 5-part / JWS 3-part / `alg: 'none'`)
3. If encrypted outer layer: decrypt
4. If signed (outer or inner): verify signature
5. If encrypted inner layer (for `jwe-in-jws`): decrypt
6. Check encryption policy: if `required` and message was not encrypted, reject with `ENCRYPTION_REQUIRED`
7. Schema validation and dispatch (existing flow)

Schema validation always runs on the **unwrapped** message, never on the JWE envelope.

### Removed APIs

`TokenSigner`, `OwnTokenSigner`, `GenericSigner`, `OwnSigner`, `getSigner`, `toTokenSigner`, `getTokenSigner`, `randomTokenSigner`, `randomSigner`, `provideTokenSigner`, `provideTokenSignerAsync` (all keystores)

---

## Implementation Notes

- **Browser keystore limitation:** Web Crypto ECDSA keys (P-256) cannot perform ECDH without separate key generation. The browser keystore provides `SigningIdentity` only (not `FullIdentity`). The function is named `provideSigningIdentity` to reflect this.
- **Web Crypto ECDSA format:** P-256 signatures use IEEE P1363 format (64-byte r||s), compatible with `@noble/curves` `p256.verify`.
- **Error masking:** `HandlerError.from()` intentionally replaces non-HandlerError exception messages with generic text (`'Handler execution failed'`) to prevent leaking sensitive info (DB connection strings, etc.).
- **Forward secrecy:** Each encryption generates a fresh ephemeral key pair; the ephemeral private key is discarded after ECDH.

---

## Downstream Impact

Kubun and Mokei depend on Enkaku and need matching updates:
- `provideTokenSigner()` / `provideTokenSignerAsync()` -> `provideFullIdentity()` / `provideFullIdentityAsync()`
- `signer` params -> `identity`
- `id` params (server) -> `identity`
- `signer.id` -> `identity.id`
- `signer.createToken()` -> `identity.signToken()`

---

## Commit Log

| Task | Phase | Description | Commit |
|------|-------|-------------|--------|
| 1 | 1 | Identity type hierarchy and type guards | `f06d5a0` |
| 2 | 1 | Identity factory functions for Ed25519 keys | `16848b7` |
| 3 | 1 | Export identity types, update signToken | `ef543de` |
| 4 | 2 | Concat KDF implementation | `ade28dd` |
| 5 | 2 | JWE encrypt/decrypt with ECDH-ES + A256GCM | `32aa047` |
| 6 | 2 | DID-based TokenEncrypter creation | `f725883` |
| 7 | 2 | Envelope wrapping/unwrapping (4 modes) | `3192e78` |
| 8 | 3 | Migrate capability to SigningIdentity | `e492362` |
| 9 | 3 | Migrate client (signer -> identity) | `f4c36cb` |
| 10 | 3 | Migrate server (id -> identity) | `5da0cd1` |
| 11 | 3 | Migrate standalone (signer -> identity) | `fa5119c` |
| 12 | 4 | Remove TokenSigner and old signer APIs | `3891965` |
| 13 | 4 | Update Node keystore | `2857ee0` |
| 14 | 4 | Update Electron keystore | `9e6a72f` |
| 15 | 4 | Update Expo keystore | `79b1e68` |
| 16 | 4 | Update Browser keystore | `0361edd` |
| 17 | 5 | Add EncryptionPolicy types | `58ddb3a` |
| 18 | 5 | Server encryption policy enforcement | `daadbe4` |
| 19 | 6 | Update E2E tests | `1120bd5` |
| 20 | 6 | Update documentation | `25a9f37` |
| 21 | 6 | Full test suite validation | `d7f68cc` |
| -- | -- | Lint + test fixes + biome formatting | `111d8b1` |
