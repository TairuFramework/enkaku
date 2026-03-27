#include <stdint.h>

#include "io.h"
#include "buffer.h"

#include "dispatcher.h"
#include "constants.h"
#include "globals.h"
#include "handlers.h"
#include "sw.h"

int apdu_dispatcher(const command_t *cmd) {
    if (cmd->cla != CLA) {
        return io_send_sw(SW_UNKNOWN_CLA);
    }

    buffer_t buf = {0};

    switch (cmd->ins) {
        case INS_GET_APP_VERSION:
            return handler_get_app_version();

        case INS_GET_PUBLIC_KEY:
            if (cmd->data == NULL || cmd->lc == 0) {
                return io_send_sw(SW_WRONG_DATA_LENGTH);
            }
            buf.ptr = cmd->data;
            buf.size = cmd->lc;
            buf.offset = 0;
            return handler_get_public_key(&buf);

        case INS_SIGN_MESSAGE:
            if (cmd->p1 != P1_FIRST && cmd->p1 != P1_CONTINUATION) {
                return io_send_sw(SW_INVALID_DATA);
            }
            if (cmd->data == NULL || cmd->lc == 0) {
                return io_send_sw(SW_WRONG_DATA_LENGTH);
            }
            buf.ptr = cmd->data;
            buf.size = cmd->lc;
            buf.offset = 0;
            return handler_sign_message(&buf, cmd->p1, cmd->p2);

        case INS_ECDH_X25519:
            if (cmd->data == NULL || cmd->lc == 0) {
                return io_send_sw(SW_WRONG_DATA_LENGTH);
            }
            buf.ptr = cmd->data;
            buf.size = cmd->lc;
            buf.offset = 0;
            return handler_ecdh_x25519(&buf);

        default:
            return io_send_sw(SW_UNKNOWN_INS);
    }
}
