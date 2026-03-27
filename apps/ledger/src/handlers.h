#pragma once

#include "buffer.h"

int handler_get_app_version(void);
int handler_get_public_key(buffer_t *cdata);
int handler_sign_message(buffer_t *cdata, uint8_t p1, uint8_t p2);
int handler_ecdh_x25519(buffer_t *cdata);
