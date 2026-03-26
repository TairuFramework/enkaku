#include <string.h>

#include "os.h"
#include "cx.h"
#include "io.h"

#include "handlers.h"
#include "constants.h"
#include "globals.h"
#include "crypto.h"
#include "sw.h"

static void sign_approved(void) {
    cx_ecfp_private_key_t private_key;

    if (derive_ed25519_keys(G_context.bip32_path, G_context.bip32_path_len,
                            &private_key, NULL) != 0) {
        explicit_bzero(&private_key, sizeof(private_key));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    uint8_t signature[ED25519_SIG_LEN];
    cx_err_t error = cx_eddsa_sign_no_throw(&private_key,
                                             CX_SHA512,
                                             G_context.message,
                                             G_context.message_len,
                                             signature,
                                             ED25519_SIG_LEN);

    explicit_bzero(&private_key, sizeof(private_key));
    explicit_bzero(G_context.message, sizeof(G_context.message));
    G_context.message_len = 0;

    if (error != CX_OK) {
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    io_send_response_pointer(signature, ED25519_SIG_LEN, SW_OK);
}

static void sign_rejected(void) {
    explicit_bzero(G_context.message, sizeof(G_context.message));
    G_context.message_len = 0;
    io_send_sw(SW_USER_REJECTED);
}

int handler_sign_message(buffer_t *cdata, uint8_t p1, uint8_t p2) {
    if (p1 == P1_FIRST) {
        // First chunk: parse path, accumulate message start
        G_context.req_type = REQ_SIGN_MESSAGE;
        G_context.message_len = 0;

        int consumed = parse_bip32_path(cdata->ptr, cdata->size,
                                         G_context.bip32_path,
                                         &G_context.bip32_path_len);
        if (consumed < 0) {
            return io_send_sw(SW_INVALID_DATA);
        }

        uint16_t msg_len = cdata->size - consumed;
        if (msg_len > MAX_MESSAGE_SIZE) {
            return io_send_sw(SW_INVALID_DATA);
        }
        if (msg_len > 0) {
            memmove(G_context.message, cdata->ptr + consumed, msg_len);
            G_context.message_len = msg_len;
        }

        // If single-chunk message (p2 == P2_SINGLE), proceed to sign
        if (p2 == P2_SINGLE) {
            // Request user confirmation, then sign
            sign_approved();
            return 0;
        }

        // More chunks expected
        return io_send_sw(SW_OK);

    } else if (p1 == P1_CONTINUATION) {
        if (G_context.req_type != REQ_SIGN_MESSAGE) {
            return io_send_sw(SW_INVALID_DATA);
        }

        if (G_context.message_len + cdata->size > MAX_MESSAGE_SIZE) {
            return io_send_sw(SW_INVALID_DATA);
        }

        memmove(G_context.message + G_context.message_len, cdata->ptr, cdata->size);
        G_context.message_len += cdata->size;

        if (p2 == P2_MORE) {
            return io_send_sw(SW_OK);
        }

        // Final chunk — sign
        sign_approved();
        return 0;
    }

    return io_send_sw(SW_INVALID_DATA);
}
