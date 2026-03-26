# Ledger App — Known Issues

**Date:** 2026-03-26
**Status:** 5/12 integration tests pass, 3 distinct issues remaining

## Working

- App builds successfully against BOLOS SDK (Nano S+ target)
- Speculos emulator starts and accepts APDUs
- `GET_APP_VERSION` (INS 0x01) returns correct version bytes
- `GET_PUBLIC_KEY` (INS 0x02) returns 32 bytes (but encoding is wrong — see Issue 1)
- APDU protocol (chunking, status words) works correctly
- Automated test runner (`tests/ledger/test.sh`) manages Docker lifecycle

## Issue 1: Ed25519 Public Key Compression is Wrong

**Symptom:** DID from Ledger doesn't match DID from `@enkaku/hd-keystore` with the same mnemonic seed. The `@noble/curves` library rejects the public key as "bad point: invalid y coordinate" when trying to convert to X25519.

**Root cause:** The BOLOS SDK returns Ed25519 public keys in a non-standard 65-byte format (`0x04 || X(32) || Y(32)`), and our compression logic in `crypto.c` is incorrect. The current code:

```c
// crypto.c lines 73-78
memmove(public_key, raw_pubkey + 1 + ED25519_PK_LEN, ED25519_PK_LEN);
if (raw_pubkey[ED25519_PK_LEN] & 1) {
    public_key[ED25519_PK_LEN - 1] |= 0x80;
}
```

This assumes standard Edwards point compression, but the SDK may use a different byte ordering or encoding. Other Ledger apps (Stellar, Solana, NEAR) have app-specific public key extraction — need to check how they do it.

**Investigation needed:**
- Check how `app-stellar` and `app-solana` extract the 32-byte Ed25519 public key from the SDK's 65-byte format
- The SDK might return coordinates in big-endian while Ed25519 uses little-endian
- May need to reverse the Y coordinate bytes
- Reference: Stellar app uses `cx_edward_compress_point_no_throw` which handles the conversion

**Relevant SDK function:** `cx_edward_compress_point_no_throw(CX_CURVE_Ed25519, raw_pubkey, 65)` — this might be the correct way to compress the point, rather than doing it manually.

## Issue 2: ECDH X25519 Returns Internal Error (0x6f00)

**Symptom:** `ECDH_X25519` handler returns status word `0x6f00` (internal error).

**Root cause:** The Ed25519→X25519 private key conversion in `ecdh_x25519.c` uses manual SHA-512 + clamp, which may not match how the SDK internally represents the Ed25519 private key. The `cx_ecfp_private_key_t` structure from `bip32_derive_with_seed_init_privkey_256` may not contain the raw seed — it might already be the scalar.

**Investigation needed:**
- Check what `cx_ecfp_private_key_t.d` contains for Ed25519 keys (raw 32-byte seed vs. SHA-512 derived scalar)
- Consider using `cx_ecdh_no_throw` directly with `CX_CURVE_Curve25519` if the SDK can convert internally
- Or use `cx_edward_decompress_point` + manual Montgomery conversion
- Check if `cx_x25519` exists as a direct API

## Issue 3: SIGN_MESSAGE Timeouts

**Symptom:** `signToken()` tests timeout at 5000ms. The APDU hangs instead of returning.

**Root cause:** Likely a race condition in the auto-approve flow. The Speculos REST API `/apdu` endpoint blocks until the app responds. But our `sign_message.c` currently calls `sign_approved()` directly (no UI flow), which should return immediately. The issue might be:
- The single-chunk detection logic is wrong (P2 values)
- The app is waiting for more chunks when it should be signing
- The response is sent but Speculos doesn't flush it

**Investigation needed:**
- Test with a raw APDU for SIGN_MESSAGE to isolate whether it's the app or the test transport
- Check if the P1/P2 values from the TypeScript `encodeSignMessageChunks` match what the C handler expects
- The C code treats `P2_SINGLE = 0x00` as the single-chunk indicator, but the TypeScript code also sends `P2 = 0x00` for the first chunk of a multi-chunk message — these are ambiguous

## Reference: SDK Versions and APIs Used

### Build Environment
- Docker image: `ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder:latest`
- Speculos image: `ghcr.io/ledgerhq/speculos`
- Target SDK: `$NANOSP_SDK` (`/opt/nanosplus-secure-sdk/`)
- API Level: 25

### SDK Crypto Helpers (preferred over raw syscalls)

Located in `$NANOSP_SDK/lib_standard_app/crypto_helpers.h`:

```c
// Key derivation — use HDW_ED25519_SLIP10 for Ed25519
bip32_derive_with_seed_init_privkey_256(HDW_ED25519_SLIP10, CX_CURVE_Ed25519, path, path_len, &privkey, NULL, NULL, 0)
bip32_derive_with_seed_get_pubkey_256(HDW_ED25519_SLIP10, CX_CURVE_Ed25519, path, path_len, raw_pubkey, NULL, CX_SHA512, NULL, 0)

// Signing — Ed25519
cx_eddsa_sign_no_throw(&privkey, CX_SHA512, msg, msg_len, sig, 64)

// ECDH
cx_ecdh_no_throw(&privkey, CX_ECDH_X, ephemeral_pubkey, 32, shared_secret, secret_len)
```

### SDK Point Compression (for Issue 1)

```c
// Located in $NANOSP_SDK/lib_cxng/include/lcx_ecfp.h
cx_err_t cx_edward_compress_point_no_throw(cx_curve_t curve, uint8_t *p, size_t p_len);
```

This function compresses a 65-byte uncompressed Edwards point in-place to 33 bytes (prefix + 32-byte compressed point). The compressed point (bytes 1-32) is the standard Ed25519 public key format.

### SDK IO Functions

Located in `$NANOSP_SDK/lib_standard_app/io.h`:

```c
int io_send_response_pointer(const uint8_t *ptr, size_t size, uint16_t sw);
int io_send_response_buffers(const buffer_t *rdatalist, size_t count, uint16_t sw);
int io_send_sw(uint16_t sw);
```

### SDK Status Words

Located in `$NANOSP_SDK/include/status_words.h`:
- `SWO_SUCCESS = 0x9000`
- `SWO_WRONG_DATA_LENGTH` (for parser failures)

### Derivation Modes

Located in `$NANOSP_SDK/include/os_seed.h`:
- `HDW_NORMAL` — standard BIP32 (secp256k1)
- `HDW_ED25519_SLIP10` — SLIP-0010 for Ed25519 (hardened only)
- `HDW_SLIP21` — SLIP-0021

### Existing App References

- **app-boilerplate**: https://github.com/LedgerHQ/app-boilerplate (secp256k1, uses `bip32_derive_get_pubkey_256`)
- **app-stellar**: https://github.com/LedgerHQ/app-stellar (Ed25519, `signHash` + `signMessage`)
- **app-solana**: https://github.com/LedgerHQ/app-solana (Ed25519, SLIP-0010)
- **Speculos REST API**: https://speculos.ledger.com/user/api.html
- **Crypto API examples**: https://developers.ledger.com/docs/device-app/references/cryptography-api-examples
