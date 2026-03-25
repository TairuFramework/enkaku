#include "handlers.h"
#include "constants.h"
#include "globals.h"
#include "crypto.h"
#include "io.h"

int handler_get_public_key(const uint8_t *cdata, uint8_t cdata_len) {
    // Parse BIP32 path
    int consumed = parse_bip32_path(cdata, cdata_len,
                                     G_context.bip32_path,
                                     &G_context.bip32_path_len);
    if (consumed < 0) {
        return io_send_sw(SW_INVALID_DATA);
    }

    // Derive Ed25519 public key (no need for private key here)
    cx_ecfp_private_key_t tmp_private;
    uint8_t public_key[ED25519_PK_LEN];

    if (derive_ed25519_keys(G_context.bip32_path, G_context.bip32_path_len,
                            &tmp_private, public_key) != 0) {
        return io_send_sw(SW_INTERNAL_ERROR);
    }

    // Zero the private key immediately - we only need the public key
    explicit_bzero(&tmp_private, sizeof(tmp_private));

    // Return the 32-byte Ed25519 public key
    return io_send_response_pointer(public_key, ED25519_PK_LEN, SW_OK);
}
