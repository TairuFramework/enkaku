#include <string.h>

#include "crypto.h"

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
    // os_derive_bip32_no_throw requires a 64-byte buffer
    uint8_t raw_private_key[64];

    // Derive raw private key using SLIP-0010
    error = os_derive_bip32_no_throw(CX_CURVE_Ed25519,
                                     path, path_len,
                                     raw_private_key, NULL);
    if (error != CX_OK) {
        explicit_bzero(raw_private_key, sizeof(raw_private_key));
        return -1;
    }

    // Initialize private key structure (only first 32 bytes are the Ed25519 seed)
    error = cx_ecfp_init_private_key_no_throw(CX_CURVE_Ed25519,
                                               raw_private_key,
                                               ED25519_PK_LEN,
                                               private_key);
    explicit_bzero(raw_private_key, sizeof(raw_private_key));
    if (error != CX_OK) {
        return -1;
    }

    // Derive public key if requested
    if (public_key != NULL) {
        cx_ecfp_public_key_t pub;
        error = cx_ecfp_generate_pair_no_throw(CX_CURVE_Ed25519, &pub, private_key, 1);
        if (error != CX_OK) {
            explicit_bzero(private_key, sizeof(cx_ecfp_private_key_t));
            return -1;
        }

        // BOLOS SDK returns 65-byte uncompressed: 0x04 || X(32) || Y(32)
        // Ed25519 compressed public key is Y(32) with sign bit of X in MSB of last byte
        memmove(public_key, pub.W + 1 + ED25519_PK_LEN, ED25519_PK_LEN);
        if (pub.W[ED25519_PK_LEN] & 1) {
            public_key[ED25519_PK_LEN - 1] |= 0x80;
        }
    }

    return 0;
}
