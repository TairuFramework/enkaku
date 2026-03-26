#pragma once

#include <stdint.h>

/**
 * APDU CLA byte — standard Ledger CLA.
 */
#define CLA 0xE0

/**
 * APDU instruction codes.
 */
#define INS_GET_APP_VERSION 0x01
#define INS_GET_PUBLIC_KEY  0x02
#define INS_SIGN_MESSAGE    0x03
#define INS_ECDH_X25519     0x04

/**
 * APDU P1 bytes for SIGN_MESSAGE chunking.
 */
#define P1_FIRST        0x00
#define P1_CONTINUATION 0x80

/**
 * APDU P2 bytes for SIGN_MESSAGE chunking.
 */
#define P2_SINGLE 0x00
#define P2_MORE   0x00
#define P2_LAST   0x01

/**
 * Limits.
 */
#define MAX_BIP32_PATH_LEN   5
#define MAX_MESSAGE_SIZE     8192

/**
 * Crypto sizes.
 */
#define ED25519_PK_LEN       32
#define ED25519_SIG_LEN      64
#define X25519_SECRET_LEN    32

/**
 * App version.
 */
#define APP_MAJOR 0
#define APP_MINOR 1
#define APP_PATCH 0
