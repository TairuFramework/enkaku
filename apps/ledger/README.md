# Enkaku Ledger App

BOLOS application for Ledger Nano S+ providing Ed25519 signing and X25519 ECDH key agreement for Enkaku identity.

## APDU Protocol

**CLA**: `0xE0`

| INS | Command | Input | Output | Confirmation |
|-----|---------|-------|--------|-------------|
| `0x01` | `GET_APP_VERSION` | none | 3 bytes (major, minor, patch) | No |
| `0x02` | `GET_PUBLIC_KEY` | encoded path | 32-byte Ed25519 public key | No |
| `0x03` | `SIGN_MESSAGE` | encoded path + chunked message | 64-byte Ed25519 signature | Yes |
| `0x04` | `ECDH_X25519` | encoded path + 32-byte ephemeral key | 32-byte shared secret | Yes |

### Derivation Path Encoding

```
[component_count: 1 byte] [components: 4 bytes each, big-endian with hardened bit]
```

All components must be hardened (SLIP-0010 Ed25519). Example: `m/44'/903'/0'` encodes as `03 8000002C 80000387 80000000`.

### SIGN_MESSAGE Chunking

| P1 | P2 | Meaning |
|----|-----|---------|
| `0x00` | `0x00` | First and only chunk — includes path + message, triggers signing |
| `0x00` | `0x80` | First chunk of multi-chunk — includes path + message start, more to come |
| `0x80` | `0x80` | Continuation chunk — message data, more to come |
| `0x80` | `0x00` | Last continuation chunk — triggers signing |

### Status Words

| Code | Meaning |
|------|---------|
| `0x9000` | Success |
| `0x6700` | Wrong data length |
| `0x6985` | User rejected |
| `0x6A80` | Invalid data |
| `0x6A82` | App not open |
| `0x6D00` | Unknown INS |
| `0x6E00` | Unknown CLA |
| `0x6F00` | Internal error |

## Build

Requires Docker.

```bash
cd apps/ledger

# Build only
docker compose run --rm build

# Build output: bin/app.elf
```

The build uses `ghcr.io/ledgerhq/ledger-app-builder` targeting the Nano S+ SDK (API level 25) with SLIP-0010 Ed25519 derivation.

## Test

Integration tests run against the Speculos emulator using a deterministic mnemonic seed.

### Automated (recommended)

```bash
# From repo root — builds if needed, starts Speculos, runs 12 tests, stops emulator
./tests/ledger/test.sh

# Force rebuild
./tests/ledger/test.sh --build

# Keep Speculos running after tests (for debugging)
./tests/ledger/test.sh --keep
```

### Manual

```bash
cd apps/ledger

# Build
docker compose run --rm build

# Start Speculos
docker compose up -d speculos

# Run tests (from repo root)
cd ../..
SPECULOS_URL=http://localhost:9999 pnpm --filter=@enkaku/ledger-tests run test

# Stop
docker compose -f apps/ledger/docker-compose.yml down
```

Speculos exposes port 9999 (configurable via `SPECULOS_PORT`) for its REST API.

### What the tests verify

12 integration tests in `tests/ledger/test/speculos.test.ts`:

- **APDU protocol**: version, public key derivation (deterministic, path-dependent)
- **IdentityProvider**: `provideIdentity()` returns `FullIdentity` with `did:key:z...` DID
- **Signing**: `signToken()` produces JWTs verifiable by standard Ed25519 verification
- **ECDH**: `agreeKey()` performs X25519 key agreement, `decrypt()` decrypts JWE
- **Cross-compatibility**: same mnemonic produces identical DIDs, signatures, and shared secrets as `@enkaku/hd-keystore`

Tests auto-skip if Speculos is not available.

## TypeScript Client

The `@enkaku/ledger-identity` package provides the TypeScript client. See `packages/ledger-identity/`.

```ts
import TransportNodeHID from '@ledgerhq/hw-transport-node-hid'
import { createLedgerIdentityProvider } from '@enkaku/ledger-identity'

const transport = await TransportNodeHID.create()
const provider = createLedgerIdentityProvider(transport)
const identity = await provider.provideIdentity('0')
// identity.id → "did:key:z6Mk..."
// identity.signToken(payload) → signed JWT
// identity.agreeKey(ephemeralPubkey) → X25519 shared secret
// identity.decrypt(jwe) → decrypted plaintext
```

## SDK Implementation Notes

### Ed25519 Public Key Compression

The BOLOS SDK returns Ed25519 public keys in 65-byte uncompressed format: `0x04 || X(32, big-endian) || Y(32, big-endian)`. Converting to the standard 32-byte compressed format (RFC 8032) requires reversing Y from big-endian to little-endian and encoding the sign of X in the MSB — the same approach used by the Solana and Stellar Ledger apps.

### X25519 ECDH

Uses the `cx_x25519` SDK syscall for direct Montgomery scalar multiplication. The Ed25519 private key seed is converted to an X25519 scalar via SHA-512 + clamp (RFC 7748). `cx_x25519` accepts the u-coordinate and scalar in little-endian (standard X25519), but its output is big-endian (from `cx_bn_export`) and must be reversed. The SDK applies RFC 7748 clamping internally.

### SDK Functions

| Function | Purpose |
|----------|---------|
| `bip32_derive_with_seed_init_privkey_256(HDW_ED25519_SLIP10, ...)` | SLIP-10 Ed25519 key derivation |
| `bip32_derive_with_seed_get_pubkey_256(HDW_ED25519_SLIP10, ...)` | Ed25519 public key (65-byte uncompressed) |
| `cx_eddsa_sign_no_throw` | Ed25519 signing |
| `cx_hash_sha512` | SHA-512 for Ed25519→X25519 scalar conversion |
| `cx_x25519` | X25519 scalar multiplication |
