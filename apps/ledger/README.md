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

### With Docker (recommended)

```bash
docker build -t enkaku-ledger-app .
docker run --rm -v $(pwd)/bin:/app/bin enkaku-ledger-app
```

### With local SDK

```bash
make BOLOS_SDK=/path/to/ledger-secure-sdk
```

## Test with Speculos

```bash
# Install Speculos
pip install speculos

# Run the app in the emulator (Nano S+)
speculos --model nanosp bin/app.elf

# In another terminal, use the @enkaku/ledger-identity TypeScript package
# with @ledgerhq/hw-transport-speculos to connect
```

## TypeScript Client

The `@enkaku/ledger-identity` package provides the TypeScript client for this app. See `packages/ledger-identity/` in the monorepo.

```ts
import TransportNodeHID from '@ledgerhq/hw-transport-node-hid'
import { createLedgerIdentityProvider } from '@enkaku/ledger-identity'

const transport = await TransportNodeHID.create()
const provider = createLedgerIdentityProvider(transport)
const identity = await provider.provideIdentity("0")
```
