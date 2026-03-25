#include "crypto.h"
#include "globals.h"

int parse_bip32_path(const uint8_t *cdata, uint8_t cdata_len,
                     uint32_t *path, uint8_t *path_len) {
    if (cdata_len < 1) {
        return -1;
    }

    uint8_t count = cdata[0];
    if (count == 0 || count > MAX_BIP32_PATH_LEN) {
        return -1;
    }

    uint8_t required = 1 + count * 4;
    if (cdata_len < required) {
        return -1;
    }

    for (uint8_t i = 0; i < count; i++) {
        uint32_t component = ((uint32_t)cdata[1 + i * 4] << 24) |
                             ((uint32_t)cdata[2 + i * 4] << 16) |
                             ((uint32_t)cdata[3 + i * 4] << 8) |
                             ((uint32_t)cdata[4 + i * 4]);
        // Ed25519 SLIP-0010 requires all components to be hardened
        if ((component & 0x80000000) == 0) {
            return -1;
        }
        path[i] = component;
    }

    *path_len = count;
    return (int)required;
}

int derive_ed25519_keys(const uint32_t *path, uint8_t path_len,
                        cx_ecfp_private_key_t *private_key,
                        uint8_t public_key[ED25519_PK_LEN]) {
    cx_err_t error;
    uint8_t raw_private_key[ED25519_PK_LEN];

    // Derive raw private key bytes using SLIP-0010 (Ed25519 variant of BIP32)
    error = os_derive_bip32_no_throw(CX_CURVE_Ed25519,
                                     path, path_len,
                                     raw_private_key, NULL);
    if (error != CX_OK) {
        explicit_bzero(raw_private_key, sizeof(raw_private_key));
        return -1;
    }

    // Initialize the private key structure
    error = cx_ecfp_init_private_key_no_throw(CX_CURVE_Ed25519,
                                               raw_private_key,
                                               ED25519_PK_LEN,
                                               private_key);
    explicit_bzero(raw_private_key, sizeof(raw_private_key));
    if (error != CX_OK) {
        return -1;
    }

    // Optionally derive the public key
    if (public_key != NULL) {
        cx_ecfp_public_key_t pub;
        error = cx_ecfp_generate_pair_no_throw(CX_CURVE_Ed25519, &pub, private_key, 1);
        if (error != CX_OK) {
            explicit_bzero(private_key, sizeof(cx_ecfp_private_key_t));
            return -1;
        }

        // The SDK returns a 65-byte uncompressed point (0x04 || X || Y).
        // Ed25519 public key is the last 32 bytes (Y coordinate) with the
        // sign bit of X encoded in the top bit of the last byte.
        // For Ed25519, the compressed form is simply the last 32 bytes
        // of the 64-byte (W + 1 prefix) public key, but we need to handle
        // the encoding properly.
        //
        // The BOLOS SDK stores Ed25519 public keys as 65 bytes: 0x04 || X(32) || Y(32)
        // The standard Ed25519 compressed public key is Y with the sign of X in the MSB.
        // We compress it here.
        memmove(public_key, pub.W + 1 + ED25519_PK_LEN, ED25519_PK_LEN);
        // Set the sign bit: if X[31] (last byte of X) has bit 0 set, set MSB of Y[31]
        if (pub.W[ED25519_PK_LEN] & 1) {
            public_key[ED25519_PK_LEN - 1] |= 0x80;
        }
    }

    return 0;
}
