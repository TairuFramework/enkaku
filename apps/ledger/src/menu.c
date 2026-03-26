#include "os.h"
#include "ux.h"

#include "globals.h"
#include "menu.h"

// Simple idle menu for Nano devices (BAGL)
UX_STEP_NOCB(ux_idle_step, nn, {"Enkaku", "is ready"});
UX_FLOW(ux_idle_flow, &ux_idle_step);

void ui_menu_main(void) {
    if (G_ux.stack_count == 0) {
        ux_stack_push();
    }
    ux_flow_init(0, ux_idle_flow, NULL);
}
