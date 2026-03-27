#include "os.h"
#include "io.h"

#include "handlers.h"
#include "constants.h"
#include "sw.h"

int handler_get_app_version(void) {
    uint8_t version[3] = {APP_MAJOR, APP_MINOR, APP_PATCH};
    return io_send_response_pointer(version, sizeof(version), SW_OK);
}
