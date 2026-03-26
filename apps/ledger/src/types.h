#pragma once

#include <stdint.h>

#include "constants.h"

/**
 * Enumeration of request types for context tracking.
 */
typedef enum {
    REQ_NONE = 0,
    REQ_GET_PUBLIC_KEY,
    REQ_SIGN_MESSAGE,
    REQ_ECDH_X25519,
} request_type_e;

/**
 * Global application context.
 */
typedef struct {
    request_type_e req_type;

    // BIP32 derivation path
    uint32_t bip32_path[MAX_BIP32_PATH_LEN];
    uint8_t bip32_path_len;

    // Message accumulation buffer for SIGN_MESSAGE
    uint8_t message[MAX_MESSAGE_SIZE];
    uint16_t message_len;

    // Ephemeral public key for ECDH
    uint8_t ephemeral_pubkey[X25519_SECRET_LEN];
} global_ctx_t;
