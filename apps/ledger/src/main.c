/**
 * Enkaku Ledger App
 *
 * Provides Ed25519 signing and X25519 ECDH key agreement for Enkaku identity.
 * APDU protocol matches @enkaku/ledger-identity TypeScript client.
 *
 * Commands:
 *   0x01 GET_APP_VERSION  — returns version bytes
 *   0x02 GET_PUBLIC_KEY   — returns Ed25519 public key for derivation path
 *   0x03 SIGN_MESSAGE     — signs arbitrary bytes with Ed25519 (chunked APDU)
 *   0x04 ECDH_X25519      — X25519 key agreement with ephemeral public key
 */

#include "os.h"
#include "ux.h"
#include "io.h"

#include "constants.h"
#include "globals.h"
#include "handlers.h"

// Global application context
app_ctx_t G_context;

/**
 * Handle an incoming APDU command.
 * Validates CLA, dispatches by INS to the appropriate handler.
 */
static int dispatch_apdu(const command_t *cmd) {
    if (cmd->cla != CLA) {
        return io_send_sw(SW_UNKNOWN_CLA);
    }

    switch (cmd->ins) {
        case INS_GET_APP_VERSION:
            return handler_get_app_version();

        case INS_GET_PUBLIC_KEY:
            return handler_get_public_key(cmd->data, cmd->lc);

        case INS_SIGN_MESSAGE:
            return handler_sign_message(cmd->data, cmd->lc, cmd->p1, cmd->p2);

        case INS_ECDH_X25519:
            return handler_ecdh_x25519(cmd->data, cmd->lc);

        default:
            return io_send_sw(SW_UNKNOWN_INS);
    }
}

/**
 * INS_GET_APP_VERSION handler — returns 3-byte version.
 */
int handler_get_app_version(void) {
    uint8_t version[3] = {
        APP_VERSION_MAJOR,
        APP_VERSION_MINOR,
        APP_VERSION_PATCH,
    };
    return io_send_response_pointer(version, sizeof(version), SW_OK);
}

/**
 * Application main entry point.
 * Runs the standard APDU receive-parse-dispatch loop.
 */
void app_main(void) {
    // Initialize global context
    explicit_bzero(&G_context, sizeof(G_context));

    io_init();

    for (;;) {
        BEGIN_TRY {
            TRY {
                // Receive and parse the next APDU
                command_t cmd;
                int recv = io_recv_command();
                if (recv < 0) {
                    return;
                }

                if (apdu_parser(G_io_apdu_buffer, recv, &cmd) < 0) {
                    io_send_sw(SW_INVALID_DATA);
                    continue;
                }

                dispatch_apdu(&cmd);
            }
            CATCH(EXCEPTION_IO_RESET) {
                THROW(EXCEPTION_IO_RESET);
            }
            CATCH_OTHER(e) {
                io_send_sw(SW_INTERNAL_ERROR);
            }
            FINALLY {
            }
        }
        END_TRY;
    }
}
