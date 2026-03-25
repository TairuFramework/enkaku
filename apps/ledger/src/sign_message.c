#include "handlers.h"
#include "constants.h"
#include "globals.h"
#include "crypto.h"
#include "io.h"
#include "nbgl_use_case.h"

// Forward declaration for UI confirmation callback
static void sign_message_approved(void);
static void sign_message_rejected(void);

int handler_sign_message(const uint8_t *cdata, uint8_t cdata_len,
                         uint8_t p1, uint8_t p2) {
    if (p1 == P1_FIRST) {
        // First chunk: parse derivation path, then accumulate message start
        G_context.message_len = 0;

        int consumed = parse_bip32_path(cdata, cdata_len,
                                         G_context.bip32_path,
                                         &G_context.bip32_path_len);
        if (consumed < 0) {
            return io_send_sw(SW_INVALID_DATA);
        }

        // Copy remaining bytes as start of message
        uint8_t msg_start_len = cdata_len - consumed;
        if (msg_start_len > 0) {
            if (msg_start_len > MAX_MESSAGE_SIZE) {
                return io_send_sw(SW_INVALID_DATA);
            }
            memmove(G_context.message, cdata + consumed, msg_start_len);
            G_context.message_len = msg_start_len;
        }

        // If this is the only chunk (p2 == P2_MORE means single-chunk),
        // we still wait for the confirmation flow below
        if (p2 == P2_LAST || cdata_len - consumed == 0) {
            // Single chunk or no continuation expected
        } else {
            // More chunks expected - acknowledge and wait
            return io_send_sw(SW_OK);
        }
    } else if (p1 == P1_CONTINUATION) {
        // Continuation chunk: append message data
        if (G_context.message_len + cdata_len > MAX_MESSAGE_SIZE) {
            return io_send_sw(SW_INVALID_DATA);
        }
        memmove(G_context.message + G_context.message_len, cdata, cdata_len);
        G_context.message_len += cdata_len;

        // If more chunks expected, acknowledge
        if (p2 == P2_MORE) {
            return io_send_sw(SW_OK);
        }
        // p2 == P2_LAST: fall through to sign
    } else {
        return io_send_sw(SW_INVALID_DATA);
    }

    // Final chunk received — request user confirmation before signing
    // For Nano devices (BAGL), show simple approve/reject screen
    // For Stax/Flex (NBGL), use the review flow
#ifdef HAVE_NBGL
    nbgl_useCaseChoice(&C_app_enkaku_64px,
                       "Sign message?",
                       "Review the signing\nrequest",
                       "Sign",
                       "Reject",
                       sign_message_approved,
                       sign_message_rejected);
#else
    // Simplified: directly approve for now (real app should show UI)
    sign_message_approved();
#endif

    return 0;
}

static void sign_message_approved(void) {
    // Derive private key
    if (derive_ed25519_keys(G_context.bip32_path, G_context.bip32_path_len,
                            &G_context.private_key, NULL) != 0) {
        explicit_bzero(&G_context.private_key, sizeof(G_context.private_key));
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Sign the accumulated message with Ed25519
    // cx_eddsa_sign_no_throw internally hashes with SHA-512 (standard Ed25519)
    uint8_t signature[ED25519_SIG_LEN];
    cx_err_t error = cx_eddsa_sign_no_throw(&G_context.private_key,
                                             CX_SHA512,
                                             G_context.message,
                                             G_context.message_len,
                                             signature,
                                             ED25519_SIG_LEN);

    // Zero private key immediately
    explicit_bzero(&G_context.private_key, sizeof(G_context.private_key));
    // Zero message buffer
    explicit_bzero(G_context.message, sizeof(G_context.message));
    G_context.message_len = 0;

    if (error != CX_OK) {
        io_send_sw(SW_INTERNAL_ERROR);
        return;
    }

    // Return the 64-byte signature
    io_send_response_pointer(signature, ED25519_SIG_LEN, SW_OK);
}

static void sign_message_rejected(void) {
    explicit_bzero(G_context.message, sizeof(G_context.message));
    G_context.message_len = 0;
    io_send_sw(SW_USER_REJECTED);
}
