#pragma once

/**
 * Enkaku Ledger App - APDU Constants
 *
 * Matches the TypeScript APDU encoding in @enkaku/ledger-identity/src/apdu.ts
 */

// APDU CLA byte
#define CLA 0xE0

// APDU INS bytes
#define INS_GET_APP_VERSION 0x01
#define INS_GET_PUBLIC_KEY  0x02
#define INS_SIGN_MESSAGE    0x03
#define INS_ECDH_X25519     0x04

// APDU P1 bytes for SIGN_MESSAGE chunking
#define P1_FIRST        0x00
#define P1_CONTINUATION 0x80

// APDU P2 bytes for SIGN_MESSAGE chunking
#define P2_MORE  0x00
#define P2_LAST  0x01

// Status words
#define SW_OK                    0x9000
#define SW_USER_REJECTED         0x6985
#define SW_INVALID_DATA          0x6A80
#define SW_APP_NOT_OPEN          0x6A82
#define SW_UNKNOWN_INS           0x6D00
#define SW_UNKNOWN_CLA           0x6E00
#define SW_INTERNAL_ERROR        0x6F00

// Limits
#define MAX_BIP32_PATH_LEN   5
#define MAX_MESSAGE_SIZE     8192
#define ED25519_PK_LEN       32
#define ED25519_SIG_LEN      64
#define X25519_SECRET_LEN    32

// App version
#define APP_VERSION_MAJOR 0
#define APP_VERSION_MINOR 1
#define APP_VERSION_PATCH 0
