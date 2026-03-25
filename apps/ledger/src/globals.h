#pragma once

#include "os.h"
#include "cx.h"
#include "constants.h"

/**
 * Global application state, persisted across APDU exchanges.
 *
 * For SIGN_MESSAGE, the message is accumulated across multiple APDUs
 * before signing on the final chunk.
 */
typedef struct {
    // BIP32 derivation path (parsed from first APDU)
    uint32_t bip32_path[MAX_BIP32_PATH_LEN];
    uint8_t bip32_path_len;

    // Message accumulation buffer for SIGN_MESSAGE
    uint8_t message[MAX_MESSAGE_SIZE];
    uint16_t message_len;

    // Derived private key (held only during signing, zeroed after)
    cx_ecfp_private_key_t private_key;
} app_ctx_t;

extern app_ctx_t G_context;
