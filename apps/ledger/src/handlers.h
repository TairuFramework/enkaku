#pragma once

#include "os.h"

/**
 * Handler for INS_GET_APP_VERSION.
 * Returns 3 bytes: major, minor, patch.
 * No user confirmation required.
 */
int handler_get_app_version(void);

/**
 * Handler for INS_GET_PUBLIC_KEY.
 * Derives Ed25519 public key at the given BIP32 path.
 * Returns 32-byte compressed Edwards point.
 * No user confirmation required.
 *
 * APDU data: [path_len (1 byte)] [path components (4 bytes each, big-endian)]
 */
int handler_get_public_key(const uint8_t *cdata, uint8_t cdata_len);

/**
 * Handler for INS_SIGN_MESSAGE.
 * Signs arbitrary message bytes with Ed25519.
 * Supports APDU chunking for messages > 255 bytes.
 * User confirmation required before signing.
 *
 * First APDU (P1=0x00): [path] [message_start]
 * Continuation (P1=0x80): [message_continuation]
 * Returns 64-byte Ed25519 signature on final chunk.
 */
int handler_sign_message(const uint8_t *cdata, uint8_t cdata_len,
                         uint8_t p1, uint8_t p2);

/**
 * Handler for INS_ECDH_X25519.
 * Performs X25519 ECDH key agreement.
 * User confirmation required.
 *
 * APDU data: [path] [32-byte ephemeral X25519 public key]
 * Returns 32-byte shared secret.
 */
int handler_ecdh_x25519(const uint8_t *cdata, uint8_t cdata_len);
