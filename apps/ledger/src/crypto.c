#include <string.h>

#include "crypto.h"
#include "crypto_helpers.h"

int parse_bip32_path(const uint8_t *data, uint8_t data_len,
                     uint32_t *path, uint8_t *path_len) {
    if (data_len < 1) {
        return -1;
    }

    uint8_t count = data[0];
    if (count == 0 || count > MAX_BIP32_PATH_LEN) {
        return -1;
    }

    uint8_t required = 1 + count * 4;
    if (data_len < required) {
        return -1;
    }

    for (uint8_t i = 0; i < count; i++) {
        uint32_t component = ((uint32_t) data[1 + i * 4] << 24) |
                             ((uint32_t) data[2 + i * 4] << 16) |
                             ((uint32_t) data[3 + i * 4] << 8) |
                             ((uint32_t) data[4 + i * 4]);
        if ((component & 0x80000000) == 0) {
            return -1;  // Ed25519 SLIP-0010 requires hardened
        }
        path[i] = component;
    }

    *path_len = count;
    return (int) required;
}

int derive_ed25519_keys(const uint32_t *path, uint8_t path_len,
                        cx_ecfp_private_key_t *private_key,
                        uint8_t public_key[ED25519_PK_LEN]) {
    cx_err_t error;

    // Use SLIP-0010 derivation mode for Ed25519
    error = bip32_derive_with_seed_init_privkey_256(
        HDW_ED25519_SLIP10,
        CX_CURVE_Ed25519,
        path, path_len,
        private_key,
        NULL,  // no chain code
        NULL, 0);  // no external seed

    if (error != CX_OK) {
        explicit_bzero(private_key, sizeof(cx_ecfp_private_key_t));
        return -1;
    }

    // Derive public key if requested
    if (public_key != NULL) {
        uint8_t raw_pubkey[65];
        error = bip32_derive_with_seed_get_pubkey_256(
            HDW_ED25519_SLIP10,
            CX_CURVE_Ed25519,
            path, path_len,
            raw_pubkey,
            NULL,  // no chain code
            CX_SHA512,
            NULL, 0);  // no external seed

        if (error != CX_OK) {
            explicit_bzero(private_key, sizeof(cx_ecfp_private_key_t));
            return -1;
        }

        // raw_pubkey is 65 bytes: 0x04 || X(32, big-endian) || Y(32, big-endian)
        // Ed25519 compressed format (RFC 8032): Y in little-endian with sign of X in MSB
        // Reverse Y coordinate from big-endian to little-endian (same as Solana/Stellar apps)
        for (int i = 0; i < ED25519_PK_LEN; i++) {
            public_key[i] = raw_pubkey[ED25519_PK_LEN + ED25519_PK_LEN - i];
        }
        if (raw_pubkey[ED25519_PK_LEN] & 1) {
            public_key[ED25519_PK_LEN - 1] |= 0x80;
        }
    }

    return 0;
}
