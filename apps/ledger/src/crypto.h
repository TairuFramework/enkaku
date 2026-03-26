#pragma once

#include <stdint.h>

#include "os.h"
#include "cx.h"
#include "os_seed.h"

#include "constants.h"

/**
 * Parse a BIP32 derivation path from a buffer.
 *
 * Format: [component_count (1 byte)] [components (4 bytes each, big-endian)]
 * All components must have the hardened bit set (SLIP-0010 Ed25519).
 *
 * @return Number of bytes consumed, or -1 on error.
 */
int parse_bip32_path(const uint8_t *data, uint8_t data_len,
                     uint32_t *path, uint8_t *path_len);

/**
 * Derive Ed25519 key pair from BIP32 path (SLIP-0010).
 *
 * @param[out] public_key  32-byte compressed Ed25519 public key (can be NULL).
 * @return 0 on success, negative on error.
 */
int derive_ed25519_keys(const uint32_t *path, uint8_t path_len,
                        cx_ecfp_private_key_t *private_key,
                        uint8_t public_key[ED25519_PK_LEN]);
