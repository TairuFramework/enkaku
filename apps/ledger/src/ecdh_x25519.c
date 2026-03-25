#include "handlers.h"
#include "constants.h"
#include "globals.h"
#include "crypto.h"
#include "io.h"
#include "nbgl_use_case.h"

// Ephemeral public key stored for confirmation callback
static uint8_t ephemeral_pubkey[X25519_SECRET_LEN];

static void ecdh_approved(void);
static void ecdh_rejected(void);

int handler_ecdh_x25519(const uint8_t *cdata, uint8_t cdata_len) {
    // Parse BIP32 path
    int consumed = parse_bip32_path(cdata, cdata_len,
                                     G_context.bip32_path,
                                     &G_context.bip32_path_len);
    if (consumed < 0) {
        return io_send_sw(SW_INVALID_DATA);
    }

    // Remaining data should be the 32-byte ephemeral X25519 public key
    uint8_t remaining = cdata_len - consumed;
    if (remaining != X25519_SECRET_LEN) {
        return io_send_sw(SW_INVALID_DATA);
    }

    memmove(ephemeral_pubkey, cdata + consumed, X25519_SECRET_LEN);

    // Request user confirmation
#ifdef HAVE_NBGL
    nbgl_useCaseChoice(&C_app_enkaku_64px,
                       "Key agreement?",
                       "Approve ECDH\nkey exchange",
                       "Approve",
                       "Reject",
                       ecdh_approved,
                       ecdh_rejected);
#else
    ecdh_approved();
#endif

    return 0;
}

static void ecdh_approved(void) {
    // Derive Ed25519 private key
    if (derive_ed25519_keys(G_context.bip32_path, G_context.bip32_path_len,
                            &G_context.private_key, NULL) != 0) {
        explicit_bzero(&G_context.private_key, sizeof(G_context.private_key));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Perform X25519 ECDH key agreement
    // The SDK converts Ed25519 private key to X25519 internally when using
    // CX_CURVE_Curve25519 with cx_ecdh_no_throw
    uint8_t shared_secret[X25519_SECRET_LEN];

    // First, convert Ed25519 private key to Curve25519 (X25519) private key
    // using the standard birational map (RFC 7748)
    cx_ecfp_private_key_t x25519_private;
    uint8_t x25519_raw[32];

    // Ed25519 to X25519 conversion: hash the Ed25519 seed with SHA-512,
    // take the first 32 bytes, clamp them per RFC 7748
    uint8_t hash[64];
    cx_hash_sha512(G_context.private_key.d, G_context.private_key.d_len, hash, 64);
    // Clamp
    hash[0] &= 248;
    hash[31] &= 127;
    hash[31] |= 64;
    memmove(x25519_raw, hash, 32);
    explicit_bzero(hash, sizeof(hash));

    cx_err_t error = cx_ecfp_init_private_key_no_throw(CX_CURVE_Curve25519,
                                                        x25519_raw, 32,
                                                        &x25519_private);
    explicit_bzero(x25519_raw, sizeof(x25519_raw));
    explicit_bzero(&G_context.private_key, sizeof(G_context.private_key));

    if (error != CX_OK) {
        explicit_bzero(&x25519_private, sizeof(x25519_private));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Perform ECDH - scalar multiply our private key with their public key
    size_t secret_len = X25519_SECRET_LEN;
    error = cx_ecdh_no_throw(&x25519_private,
                              CX_ECDH_X25519,
                              ephemeral_pubkey,
                              X25519_SECRET_LEN,
                              shared_secret,
                              secret_len);

    explicit_bzero(&x25519_private, sizeof(x25519_private));
    explicit_bzero(ephemeral_pubkey, sizeof(ephemeral_pubkey));

    if (error != CX_OK) {
        explicit_bzero(shared_secret, sizeof(shared_secret));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Return the 32-byte shared secret
    io_send_response_pointer(shared_secret, X25519_SECRET_LEN, SW_OK);
    explicit_bzero(shared_secret, sizeof(shared_secret));
}

static void ecdh_rejected(void) {
    explicit_bzero(ephemeral_pubkey, sizeof(ephemeral_pubkey));
    io_send_sw(SW_USER_REJECTED);
}
