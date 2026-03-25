#pragma once

#include "os.h"
#include "cx.h"
#include "constants.h"

/**
 * Parse a BIP32 derivation path from APDU data.
 *
 * Format: [component_count (1 byte)] [components (4 bytes each, big-endian)]
 * All components must have the hardened bit set (required for Ed25519/SLIP-0010).
 *
 * @param[in]  cdata      Raw APDU data
 * @param[in]  cdata_len  Length of APDU data
 * @param[out] path       Output path array
 * @param[out] path_len   Output path length
 * @return Number of bytes consumed from cdata, or -1 on error
 */
int parse_bip32_path(const uint8_t *cdata, uint8_t cdata_len,
                     uint32_t *path, uint8_t *path_len);

/**
 * Derive Ed25519 key pair from BIP32 path using SLIP-0010.
 *
 * @param[in]  path       BIP32 path components
 * @param[in]  path_len   Number of path components
 * @param[out] private_key Derived private key (caller must zero after use)
 * @param[out] public_key  32-byte Ed25519 public key (can be NULL)
 * @return 0 on success, negative on error
 */
int derive_ed25519_keys(const uint32_t *path, uint8_t path_len,
                        cx_ecfp_private_key_t *private_key,
                        uint8_t public_key[ED25519_PK_LEN]);
