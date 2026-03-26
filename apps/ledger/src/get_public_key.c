#include <string.h>

#include "os.h"
#include "io.h"

#include "handlers.h"
#include "constants.h"
#include "globals.h"
#include "crypto.h"
#include "sw.h"

int handler_get_public_key(buffer_t *cdata) {
    int consumed = parse_bip32_path(cdata->ptr, cdata->size,
                                     G_context.bip32_path,
                                     &G_context.bip32_path_len);
    if (consumed < 0) {
        return io_send_sw(SW_INVALID_DATA);
    }

    cx_ecfp_private_key_t tmp_private;
    uint8_t public_key[ED25519_PK_LEN];

    if (derive_ed25519_keys(G_context.bip32_path, G_context.bip32_path_len,
                            &tmp_private, public_key) != 0) {
        return io_send_sw(SW_INTERNAL_ERROR);
    }

    explicit_bzero(&tmp_private, sizeof(tmp_private));

    return io_send_response_pointer(public_key, ED25519_PK_LEN, SW_OK);
}
