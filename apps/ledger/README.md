# Enkaku Ledger App

BOLOS application for Ledger hardware devices providing Ed25519 signing and X25519 ECDH key agreement for Enkaku identity.

## APDU Protocol

| INS | Command | Input | Output | Confirmation |
|-----|---------|-------|--------|-------------|
| `0x01` | `GET_APP_VERSION` | none | 3 bytes (major, minor, patch) | No |
| `0x02` | `GET_PUBLIC_KEY` | encoded path | 32-byte Ed25519 public key | No |
| `0x03` | `SIGN_MESSAGE` | encoded path + chunked message | 64-byte Ed25519 signature | Yes |
| `0x04` | `ECDH_X25519` | encoded path + 32-byte ephemeral key | 32-byte shared secret | Yes |

**CLA**: `0xE0`

### Derivation Path Encoding

```
[component_count: 1 byte] [components: 4 bytes each, big-endian with hardened bit]
```

Example: `m/44'/903'/0'` encodes as `03 8000002C 80000387 80000000`

### SIGN_MESSAGE Chunking

- First chunk: `P1=0x00, P2=0x00` — data = path + message start
- Continuation: `P1=0x80, P2=0x00` — data = message continuation
- Final chunk: `P1=0x80, P2=0x01` — data = last message bytes, triggers signing

### Status Words

| Code | Meaning |
|------|---------|
| `0x9000` | Success |
| `0x6985` | User rejected |
| `0x6A80` | Invalid data |
| `0x6A82` | App not open |
| `0x6D00` | Unknown INS |
| `0x6E00` | Unknown CLA |
| `0x6F00` | Internal error |

## Build

### With Docker Compose (recommended)

```bash
cd apps/ledger

# Build the app + start Speculos emulator
docker compose up --build

# Build only (no emulator)
docker compose run --rm build
```

### With Docker (manual)

```bash
docker run --rm -v "$(pwd):/app" \
  ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder:latest \
  bash -c "cd /app && BOLOS_SDK=\$NANOSP_SDK make"
```

### With local SDK

```bash
make BOLOS_SDK=/path/to/ledger-secure-sdk
```

## Test with Speculos

### Start the emulator

```bash
cd apps/ledger

# Option 1: Docker Compose (builds app + starts Speculos)
docker compose up --build

# Option 2: Manual (if app is already built)
speculos --model nanosp bin/app.elf \
  --seed "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" \
  --apdu-port 40000 --api-port 5000 --display headless
```

Speculos exposes:
- **Port 5000**: REST API (APDU exchange, button simulation, screenshots)
- **Port 40000**: Raw TCP APDU port

### Run integration tests

With Speculos running:

```bash
# From repo root
pnpm run test:unit --filter=@enkaku/ledger-identity

# Or with a custom Speculos URL
SPECULOS_URL=http://localhost:5000 pnpm run test:unit --filter=@enkaku/ledger-identity
```

The integration tests in `packages/ledger-identity/test/speculos.test.ts` auto-detect whether Speculos is available and skip if not. They auto-approve device prompts via the REST API.

### What the tests verify

- `GET_PUBLIC_KEY` returns a valid 32-byte Ed25519 public key
- `provideIdentity()` produces a valid `FullIdentity` with `did:key:z...` DID
- `signToken()` produces JWTs verifiable by standard Ed25519 verification
- `agreeKey()` performs X25519 ECDH and returns a valid shared secret
- **Cross-compatibility**: same DID and shared secrets as `@enkaku/hd-keystore` with the same mnemonic seed

## TypeScript Client

The `@enkaku/ledger-identity` package provides the TypeScript client for this app. See `packages/ledger-identity/` in the monorepo.

```ts
import TransportNodeHID from '@ledgerhq/hw-transport-node-hid'
import { createLedgerIdentityProvider } from '@enkaku/ledger-identity'

const transport = await TransportNodeHID.create()
const provider = createLedgerIdentityProvider(transport)
const identity = await provider.provideIdentity("0")
```
