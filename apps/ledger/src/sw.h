#pragma once

/**
 * Status words for APDU responses.
 */
typedef enum {
    SW_OK                = 0x9000,
    SW_USER_REJECTED     = 0x6985,
    SW_INVALID_DATA      = 0x6A80,
    SW_APP_NOT_OPEN      = 0x6A82,
    SW_UNKNOWN_INS       = 0x6D00,
    SW_UNKNOWN_CLA       = 0x6E00,
    SW_INTERNAL_ERROR    = 0x6F00,
    SW_WRONG_DATA_LENGTH = 0x6700,
} sw_e;
