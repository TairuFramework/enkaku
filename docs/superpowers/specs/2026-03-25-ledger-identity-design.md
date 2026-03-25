# Ledger Identity & HD Keystore

**Status:** design approved, pending implementation

**Date:** 2026-03-25

---

## Goals

1. **Hardware-backed root identity** — Use a Ledger hardware wallet to hold a user's root Ed25519 key, producing a valid `SigningIdentity` and `DecryptingIdentity` without exposing key material to software
2. **Unified consumer API** — Both hardware and software identity providers implement `IdentityProvider<FullIdentity>`, making the backend transparent to consumers
3. **Software recovery** — If the Ledger is lost, the same keys (and DID) can be derived from the BIP39 mnemonic using a purely software HD keystore

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hardware interface | Custom Ledger app (not WebAuthn) | WebAuthn can't produce standard JWS signatures (wraps data in authenticator structures), credentials are origin-bound, and no ECDH support for `DecryptingIdentity`. |
| Signing algorithm | Ed25519 (EdDSA) | Matches node-keystore, expo-keystore, electron-keystore. BOLOS firmware supports Ed25519 natively. Produces standard JWS verifiable by existing `defaultVerifiers.EdDSA`. |
| Key derivation | BIP39 mnemonic + SLIP-0010 hardened paths | Ledger uses this internally. SLIP-0010 is required because BIP32 doesn't support Ed25519. Same derivation in software enables recovery from mnemonic. |
| SLIP-0010 library | `micro-key-producer/slip10.js` | By paulmillr (same author as `@noble/*` and `@scure/*`). Provides SLIP-0010 Ed25519 HD derivation. `@scure/bip32` does NOT support Ed25519 — it is secp256k1-only. |
| Consumer API | `IdentityProvider<T>` type in `@enkaku/token` | Abstracts over key source. Consumers call `provideIdentity(keyID)` regardless of whether keys come from hardware, HD derivation, or platform keystores. |
| Ledger transport | Injected by consumer | Consumer provides transport from `@ledgerhq/hw-transport-*` (node-hid, webhid, BLE). No platform-specific Enkaku packages needed — adding new platforms is consumer-side. |
| HD keystore API | Implements both `KeyStore<Uint8Array>` and `IdentityProvider<FullIdentity>` | `KeyStore` gives raw key access for interop with existing identity creation functions. `IdentityProvider` gives convenience. Seed is ephemeral (in-memory), not persisted. |
| Ledger app location | `apps/ledger/` in monorepo | Separate from `packages/` (C code, different toolchain). Docker-based build via `ghcr.io/ledgerhq/ledger-app-builder`. |
| Initial transport | Node HID (node-hid) | Covers Node.js CLI and Electron. Design supports adding browser (WebHID) and React Native (BLE) without new packages. |
| Shared secret exposure | ECDH returns raw shared secret to host | Ledger has limited memory/compute — AES-GCM decryption of arbitrary payloads must happen on host. The shared secret is ephemeral and used only for key derivation. Acceptable tradeoff vs. full on-device decryption. |

---

## Components

### 1. Custom Ledger App (`apps/ledger/`)

BOLOS C application with four APDU commands:

| INS | Command | Parameters | Returns | Confirmation |
|-----|---------|-----------|---------|-------------|
| `0x01` | `GET_APP_VERSION` | none | version bytes | None |
| `0x02` | `GET_PUBLIC_KEY` | derivation path | 32-byte Ed25519 public key | None (read-only) |
| `0x03` | `SIGN_MESSAGE` | derivation path, message bytes | 64-byte Ed25519 signature | User confirms on device |
| `0x04` | `ECDH_X25519` | derivation path, 32-byte ephemeral public key | 32-byte shared secret | User confirms on device |

**CLA**: `0xE0` (standard Ledger CLA)

**APDU chunking protocol** (for `SIGN_MESSAGE` with payloads > 255 bytes):
- First chunk: P1=`0x00`, P2=`0x00`, data = derivation path + initial message bytes
- Continuation chunks: P1=`0x80`, P2=`0x00`, data = next message bytes
- Final chunk: P1=`0x80`, P2=`0x01`, data = remaining message bytes
- Derivation path is sent in first chunk only
- Maximum total message size: 8KB (sufficient for any JWT)

**Signing**: `cx_eddsa_sign_no_throw` on raw message bytes — no domain-specific framing, producing signatures identical to `ed25519.sign()` from `@noble/curves`.

**ECDH**: Converts the Ed25519 private key to X25519 (Montgomery form) on-device via standard birational map, then performs ECDH via `cx_ecdh`.

**Build toolchain**: Docker-based using `ghcr.io/ledgerhq/ledger-app-builder`.

**Error handling**: APDU status words map to specific error conditions:
- `0x6985` — user rejected confirmation on device
- `0x6A80` — invalid derivation path
- `0x6A82` — app not open on device
- `0x6D00` — unknown INS byte
- `0x6E00` — unknown CLA byte
- `0x9000` — success

### 2. `@enkaku/ledger-identity`

TypeScript package providing `IdentityProvider<FullIdentity>` backed by a Ledger device.

**Transport interface:**

```ts
type LedgerTransport = {
  send(cla: number, ins: number, p1: number, p2: number, data?: Uint8Array): Promise<Uint8Array>
}
```

Compatible with all `@ledgerhq/hw-transport-*` packages.

**API:**

```ts
function createLedgerIdentityProvider(
  transport: LedgerTransport,
  options?: { basePath?: string },  // default: "44'/903'"
): IdentityProvider<FullIdentity>
```

- `provideIdentity(keyID)` where `keyID` is a derivation index (`"0"`) or full path (`"44'/903'/0'"`)
- Calls `GET_PUBLIC_KEY` to obtain public key, computes DID via `getDID(CODECS.EdDSA, publicKey)`
- Returns `FullIdentity` where:
  - `signToken()` replicates the JWT construction logic from `createSigningIdentity` in `@enkaku/token` (header/payload assembly, base64url encoding, data string construction), then sends the data string bytes to `SIGN_MESSAGE` for signing on device
  - `agreeKey()` sends ephemeral public key to `ECDH_X25519`, returns shared secret
  - `decrypt()` uses `agreeKey()` to derive shared secret, then decrypts JWE locally using the same `concatKDF` + AES-GCM logic as `@enkaku/token`

**Error handling:**

```ts
class LedgerError extends Error {
  constructor(message: string, public readonly statusCode: number) { ... }
}

class LedgerUserRejectedError extends LedgerError { ... }
class LedgerDisconnectedError extends LedgerError { ... }
class LedgerAppNotOpenError extends LedgerError { ... }
```

Transport disconnection during an operation throws `LedgerDisconnectedError`. User rejection on device throws `LedgerUserRejectedError`.

**Observability:** Uses `@enkaku/otel` tracing (`withSpan`) and `@enkaku/log` structured logging, consistent with existing keystore packages.

**Usage:**

```ts
import TransportNodeHID from '@ledgerhq/hw-transport-node-hid'
import { createLedgerIdentityProvider } from '@enkaku/ledger-identity'

const transport = await TransportNodeHID.create()
const provider = createLedgerIdentityProvider(transport)
const identity = await provider.provideIdentity("0")
// identity.id === "did:key:z6Mk..."
// identity.signToken(...) signs on device
// identity.agreeKey(...) performs ECDH on device
```

### 3. `@enkaku/hd-keystore`

TypeScript package providing both `KeyStore<Uint8Array>` and `IdentityProvider<FullIdentity>` via SLIP-0010 HD derivation.

**Dependencies:** `@scure/bip39` (mnemonic handling), `micro-key-producer` (SLIP-0010 Ed25519 derivation) — both from paulmillr, same ecosystem as `@noble/*`.

**API:**

```ts
class HDKeyStore implements KeyStore<Uint8Array, HDKeyEntry>, IdentityProvider<FullIdentity> {
  static fromMnemonic(mnemonic: string, options?: { basePath?: string }): HDKeyStore
  static fromSeed(seed: Uint8Array, options?: { basePath?: string }): HDKeyStore

  // KeyStore<Uint8Array>
  entry(keyID: string): HDKeyEntry

  // IdentityProvider<FullIdentity>
  provideIdentity(keyID: string): Promise<FullIdentity>
}

class HDKeyEntry implements KeyEntry<Uint8Array> {
  readonly keyID: string
  getAsync(): Promise<Uint8Array | null>    // derives key at path, always returns non-null
  setAsync(privateKey: Uint8Array): Promise<void>  // throws (keys are derived, not stored)
  provideAsync(): Promise<Uint8Array>       // derives key at path
  removeAsync(): Promise<void>              // no-op
}
```

- `keyID` is a derivation index (`"0"` → `m/44'/903'/0'`) or full path
- Seed is held in memory, not persisted. For persistent storage, use a platform keystore to store the seed bytes.
- `provideIdentity()` derives key then wraps via `createFullIdentity()`

**Note on `getAsync()`:** Unlike other keystores where `getAsync()` returns `null` for unprovisioned keys, HD derivation is deterministic — any valid path produces a key. `getAsync()` always returns a value. This is a semantic difference consumers should be aware of.

**Observability:** Uses `@enkaku/otel` and `@enkaku/log` consistent with existing keystore packages.

**Usage:**

```ts
import { HDKeyStore } from '@enkaku/hd-keystore'

// Software recovery from mnemonic
const store = HDKeyStore.fromMnemonic('abandon abandon ... about')
const identity = await store.provideIdentity("0")
// identity.id matches the Ledger's DID for the same path
```

### 4. `IdentityProvider` type (already added to `@enkaku/token`)

```ts
export type IdentityProvider<T extends SigningIdentity = SigningIdentity> = {
  provideIdentity(keyID: string): Promise<T>
}
```

Existing keystores can optionally implement this interface by wrapping their `provideFullIdentity()` / `provideSigningIdentity()` functions. This is additive — no breaking changes.

---

## Consumer Experience

Switching between identity backends requires changing only the provider setup:

```ts
// Hardware (Ledger)
const provider = createLedgerIdentityProvider(transport)

// Software recovery (mnemonic)
const provider = HDKeyStore.fromMnemonic(mnemonic)

// Platform keystore (future — wrapping existing provideFullIdentity)
// const provider = createNodeIdentityProvider('my-service')

// All produce the same type
const identity: FullIdentity = await provider.provideIdentity("my-key")

// Use identically downstream
const capability = await createCapability(identity, { sub: identity.id, aud: deviceDID, ... })
const token = await identity.signToken(payload)
```

---

## Key Derivation Path

Base path: `m/44'/903'` (903 is a placeholder — a real coin type would need SLIP-0044 registration or use a non-registered range). The base path is configurable via the `basePath` option on both `createLedgerIdentityProvider` and `HDKeyStore`. Note: changing the coin type changes all derived DIDs, which is a breaking change for identity continuity.

Full path: `m/44'/903'/<index>'` where index identifies different root identities.

All path components are hardened (required by SLIP-0010 for Ed25519).

---

## Prerequisites

**`decrypt()` in `@enkaku/token`**: The existing `createDecryptingIdentity` has `decrypt()` stubbed as `throw new Error('Not implemented')`. Both `ledger-identity` and `hd-keystore` need a working `decrypt()` implementation. This should be implemented in `@enkaku/token` first (using `agreeKey()` + `concatKDF` + AES-GCM, mirroring the existing `decryptToken` flow), then the Ledger and HD implementations delegate to the same logic with their respective `agreeKey()`.

---

## Testing Strategy

- **Ledger app**: Tested against Speculos emulator (Ledger's official device simulator, available as Docker image and via `@ledgerhq/hw-transport-speculos` or `@ledgerhq/device-transport-kit-speculos`)
- **`ledger-identity`**: Unit tests with mocked transport (APDU request/response pairs); integration tests with Speculos
- **`hd-keystore`**: Unit tests verifying SLIP-0010 derivation against known test vectors; cross-validation that derived keys match Ledger output (via Speculos)
- **Cross-package**: Verify that `ledger-identity` and `hd-keystore` produce identical DIDs and interoperable signatures for the same derivation path

---

## Out of Scope

- MLS message archival (separate spec, depends on these packages)
- Browser/React Native transports (additive, no design changes needed)
- Wrapping existing keystores in `IdentityProvider` (can be done incrementally)
- Ledger app catalog submission (post-MVP)
- SLIP-0044 coin type registration
