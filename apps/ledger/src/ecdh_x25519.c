#include <string.h>

#include "os.h"
#include "cx.h"
#include "io.h"

#include "handlers.h"
#include "constants.h"
#include "globals.h"
#include "crypto.h"
#include "sw.h"

static void ecdh_approved(void) {
    cx_ecfp_private_key_t ed_private;

    if (derive_ed25519_keys(G_context.bip32_path, G_context.bip32_path_len,
                            &ed_private, NULL) != 0) {
        explicit_bzero(&ed_private, sizeof(ed_private));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Convert Ed25519 private key to X25519 scalar via SHA-512 + clamp (RFC 7748)
    uint8_t hash[64];
    cx_hash_sha512(ed_private.d, ed_private.d_len, hash, sizeof(hash));
    explicit_bzero(&ed_private, sizeof(ed_private));

    hash[0] &= 248;
    hash[31] &= 127;
    hash[31] |= 64;

    // cx_x25519 takes u-coordinate and scalar in little-endian (standard X25519),
    // but outputs the result in big-endian (via cx_bn_export)
    uint8_t u[X25519_SECRET_LEN];
    memmove(u, G_context.ephemeral_pubkey, X25519_SECRET_LEN);
    explicit_bzero(G_context.ephemeral_pubkey, sizeof(G_context.ephemeral_pubkey));

    // X25519 scalar multiplication: u = clamp(hash) * u
    cx_err_t error = cx_x25519(u, hash, 32);
    explicit_bzero(hash, sizeof(hash));

    if (error != CX_OK) {
        explicit_bzero(u, sizeof(u));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Reverse output from big-endian (cx_bn_export) to little-endian (X25519 standard)
    uint8_t shared_secret[X25519_SECRET_LEN];
    for (int i = 0; i < X25519_SECRET_LEN; i++) {
        shared_secret[i] = u[X25519_SECRET_LEN - 1 - i];
    }
    explicit_bzero(u, sizeof(u));

    io_send_response_pointer(shared_secret, X25519_SECRET_LEN, SW_OK);
    explicit_bzero(shared_secret, sizeof(shared_secret));
}

static void ecdh_rejected(void) {
    explicit_bzero(G_context.ephemeral_pubkey, sizeof(G_context.ephemeral_pubkey));
    io_send_sw(SW_USER_REJECTED);
}

int handler_ecdh_x25519(buffer_t *cdata) {
    G_context.req_type = REQ_ECDH_X25519;

    int consumed = parse_bip32_path(cdata->ptr, cdata->size,
                                     G_context.bip32_path,
                                     &G_context.bip32_path_len);
    if (consumed < 0) {
        return io_send_sw(SW_INVALID_DATA);
    }

    uint8_t remaining = cdata->size - consumed;
    if (remaining != X25519_SECRET_LEN) {
        return io_send_sw(SW_INVALID_DATA);
    }

    memmove(G_context.ephemeral_pubkey, cdata->ptr + consumed, X25519_SECRET_LEN);

    // For now, auto-approve (UI confirmation would go here)
    ecdh_approved();
    return 0;
}
