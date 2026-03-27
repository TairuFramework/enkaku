# Ledger Identity & HD Keystore

**Status:** complete
**Completed:** 2026-03-26
**Branch:** `feat/ledger`

## Goal

Hardware-backed root identity via a custom Ledger app, with a software HD keystore for recovery, both producing `FullIdentity` via the `IdentityProvider` interface.

## Key Design Decisions

- **Custom Ledger app** over WebAuthn — WebAuthn can't produce standard JWS signatures (wraps data in authenticator structures), credentials are origin-bound, and no ECDH support for `DecryptingIdentity`.
- **SLIP-0010 Ed25519** key derivation — required because standard BIP32 doesn't support Ed25519. Uses `micro-key-producer/slip10.js` (not `@scure/bip32` which is secp256k1-only).
- **`IdentityProvider<T>` abstraction** in `@enkaku/token` — consumers call `provideIdentity(keyID)` regardless of hardware/software backend.
- **Shared secret exposed to host** — Ledger performs X25519 ECDH on-device, returns shared secret. AES-GCM decryption happens on host (Ledger has limited memory for arbitrary payloads).
- **Injected transport** — consumer provides `@ledgerhq/hw-transport-*` (node-hid, webhid, BLE). No platform-specific Enkaku packages needed.

## What Was Built

- **`@enkaku/hd-keystore`** — Software HD keystore implementing `KeyStore<Uint8Array>` + `IdentityProvider<FullIdentity>`. BIP39 mnemonic to Ed25519 keys via SLIP-0010. 24 tests.
- **`@enkaku/ledger-identity`** — TypeScript client for the Ledger app. APDU encoding, chunked signing, error handling. 20 tests.
- **`apps/ledger/`** — BOLOS C app for Nano S+ with 4 APDU commands: `GET_APP_VERSION`, `GET_PUBLIC_KEY`, `SIGN_MESSAGE`, `ECDH_X25519`. Docker-based build. 12 Speculos integration tests.
- **`IdentityProvider` type** added to `@enkaku/token`, `decrypt()` implemented on `DecryptingIdentity`.
- **Cross-compatibility verified** — same mnemonic produces identical DIDs, signatures, and X25519 shared secrets from both Ledger and HD keystore.

## Notable Implementation Details

- Ed25519 public key extraction from BOLOS SDK requires byte-reversing Y coordinate (big-endian SDK format to little-endian RFC 8032), matching the Solana/Stellar Ledger app pattern.
- X25519 ECDH uses `cx_x25519` syscall directly (not `cx_ecdh_no_throw`). Inputs are little-endian, output is big-endian and must be reversed.
- SIGN_MESSAGE chunking uses `P2_LAST=0x00` / `P2_MORE=0x80` to disambiguate single vs multi-chunk first APDUs.
