# Ledger Root Identity & Delegated Device Authorization

**Status:** research complete, pending implementation

**Date:** 2026-03-25

---

## Goals

1. **Hardware-backed root identity** — Use a Ledger hardware wallet to hold a user's root Ed25519 key, producing a valid `SigningIdentity` without exposing key material to software
2. **Capability delegation to devices** — Root identity delegates scoped, time-limited permissions to device-specific identities via `CapabilityToken`, so devices act on behalf of the user without the Ledger plugged in
3. **Encrypted message archival** — Device clients can archive MLS-encrypted messages to a backup server, recoverable only by the root identity (Ledger)

---

## Context

Enkaku's identity system (`@enkaku/token`) defines a hierarchy: `Identity` > `SigningIdentity` > `DecryptingIdentity` > `FullIdentity` > `OwnIdentity`. The `SigningIdentity` interface is async and requires only `id` (DID string) and `signToken()` — no direct key access. This makes it suitable for wrapping a hardware signer.

The capability system (`@enkaku/capability`) already supports delegation chains (max depth 20) with scoped permissions (`act`/`res` wildcards), expiration, and chain validation. A root identity can delegate to a device identity, which can sub-delegate further.

The MLS group system (`@enkaku/group`) treats each device as a separate DID/member. Encryption is group-wide via TreeKEM — all members can decrypt. The Ledger doesn't need to be a group member.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hardware interface | Custom Ledger app (not WebAuthn/FIDO2) | WebAuthn signatures wrap data in authenticator/client structures — cannot produce standard JWS signatures. WebAuthn credentials are origin-bound, blocking cross-service root identity. No ECDH support for `DecryptingIdentity`. |
| Signing algorithm | Ed25519 (EdDSA) | Matches node-keystore, expo-keystore, electron-keystore. BOLOS firmware fully supports Ed25519 via `cx_eddsa_sign_no_throw`. Produces standard JWS signatures verifiable by existing `defaultVerifiers.EdDSA`. |
| Key derivation | SLIP-0010 hardened paths (e.g., `m/44'/903'/0'`) | Ed25519 requires hardened-only BIP32 derivation per SLIP-0010. Coin type TBD (903 placeholder). Multiple paths allow multiple root identities per device. |
| DID generation | From Ledger's Ed25519 public key via `getDID(CODECS.EdDSA, publicKey)` | Public key is extractable without exposing private key. DID format identical to software identities — no protocol changes. |
| Delegation mechanism | Existing `@enkaku/capability` | `createCapability()` already handles root capabilities (iss === sub) and delegated capabilities with chain validation. No new protocol needed. |
| Ledger role in MLS | Authorization only, not group membership | Ledger can't track epoch advances (cold storage). Devices join groups with their own keys. Ledger signs capability tokens authorizing devices to act on behalf of the user. |
| Archival: incremental | SecretTree per epoch, JWE-encrypted to root | `secretTreeEncoder` is exported from ts-mls. Small payload (~hundreds of bytes). Limits blast radius if root compromised — only one epoch's keys per archive entry. |
| Archival: snapshots | Full `ClientState`, JWE-encrypted to root | `clientStateEncoder` is exported from ts-mls. Periodic checkpoints for faster recovery — restore from latest snapshot + apply incrementals. |
| Archival: JWE decryption | X25519 ECDH on custom Ledger app | BOLOS supports `cx_ecdh` with Curve25519. Custom app converts Ed25519 key to X25519 (Montgomery form) on-device, performs ECDH, returns shared secret. |
| ts-mls changes | None | ts-mls is an external dependency. All needed types (`ClientState`, `SecretTree`, encoders/decoders) are already exported. `historicalReceiverData` stores old epoch state. |

---

## Architecture

### Delegation Flow

```
SETUP (Ledger plugged in, one-time per device):

  Ledger (root)                          Device (platform keystore)
  ┌──────────────┐                       ┌──────────────┐
  │ Ed25519 key  │                       │ Ed25519 key  │
  │ did:key:zR.. │──── createCapability ──→ did:key:zD.. │
  └──────────────┘    {                  └──────────────┘
                        sub: rootDID,
                        aud: deviceDID,
                        act: 'rpc/*',
                        res: 'api/*',
                        exp: +30 days
                      }
                      → CapabilityToken (stored on device)

RUNTIME (Ledger NOT needed):

  Device signs requests with own key, includes capability in `cap` field.
  Server calls checkCapability() → validates chain → authorizes as root user.
```

### Archival Flow

```
NORMAL OPERATION (automatic, no Ledger):

  GroupHandle ── epoch transition ──→ capture SecretTree
                                      ↓
                                  secretTreeEncoder()
                                      ↓
                                  JWE encrypt to root X25519 public key
                                      ↓
                                  push to backup server

  Periodic ──→ clientStateEncoder(full state)
               ↓
           JWE encrypt to root X25519 public key
               ↓
           push to backup server (checkpoint)

RECOVERY (Ledger needed):

  Latest snapshot ──→ Ledger decrypts JWE (X25519 ECDH)
                      ↓
                  clientStateDecoder() → base ClientState
                      ↓
                  Apply incremental epoch archives
                      ↓
                  Decrypt archived messages
```

---

## What Needs to Be Built

**Custom Ledger app (`app-enkaku`)** — BOLOS C app
- `GET_PUBLIC_KEY`: Returns Ed25519 public key for derivation path
- `SIGN_MESSAGE`: Signs arbitrary-length message with Ed25519 (APDU chunking)
- `ECDH_X25519`: X25519 key agreement for JWE decryption
- User confirmation on device screen for each operation

**`@enkaku/ledger-keystore`** — TypeScript package
- `createLedgerSigningIdentity(transport, path)` → `SigningIdentity`
- `createLedgerDecryptingIdentity(transport, path)` → `DecryptingIdentity`
- Transport abstraction: Node HID, WebHID, BLE (via DMK or `@ledgerhq/hw-transport-*`)
- DID derived from device's Ed25519 public key

**`GroupArchiver`** — Extension to `@enkaku/group`
- Hooks into `GroupHandle` epoch transitions
- Incremental: captures and JWE-encrypts `SecretTree` per epoch
- Snapshot: serializes and JWE-encrypts full `ClientState` periodically or on demand
- Configurable archive backend (hub endpoint, S3, local)
- Recovery utility: snapshot + incrementals → decrypted message history

---

## Follow-on Work

- Capability revocation list (use `verifyToken` hook in `DelegationChainOptions`)
- Multi-Ledger support (e.g., personal + organizational root identities)
- Ledger app submission to Ledger's app catalog
- JWE multi-recipient (roadmap backlog item) could simplify archival if encrypting to multiple roots
