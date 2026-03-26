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

    // Convert Ed25519 private key to X25519 via SHA-512 + clamp (RFC 7748)
    uint8_t hash[64];
    cx_hash_sha512(ed_private.d, ed_private.d_len, hash, sizeof(hash));
    explicit_bzero(&ed_private, sizeof(ed_private));

    hash[0] &= 248;
    hash[31] &= 127;
    hash[31] |= 64;

    cx_ecfp_private_key_t x25519_private;
    cx_err_t error = cx_ecfp_init_private_key_no_throw(CX_CURVE_Curve25519,
                                                        hash, 32,
                                                        &x25519_private);
    explicit_bzero(hash, sizeof(hash));

    if (error != CX_OK) {
        explicit_bzero(&x25519_private, sizeof(x25519_private));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // ECDH key agreement
    uint8_t shared_secret[X25519_SECRET_LEN];
    size_t secret_len = X25519_SECRET_LEN;
    error = cx_ecdh_no_throw(&x25519_private,
                              CX_ECDH_X,
                              G_context.ephemeral_pubkey,
                              X25519_SECRET_LEN,
                              shared_secret,
                              secret_len);

    explicit_bzero(&x25519_private, sizeof(x25519_private));
    explicit_bzero(G_context.ephemeral_pubkey, sizeof(G_context.ephemeral_pubkey));

    if (error != CX_OK) {
        explicit_bzero(shared_secret, sizeof(shared_secret));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

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
