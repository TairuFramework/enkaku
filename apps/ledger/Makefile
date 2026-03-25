# Enkaku Ledger App - Makefile
#
# Build with: docker run --rm -v $(pwd):/app ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder:latest
# Or locally: make BOLOS_SDK=/path/to/sdk

ifeq ($(BOLOS_SDK),)
$(error Environment variable BOLOS_SDK is not set)
endif

include $(BOLOS_SDK)/Makefile.defines

# Application name and version
APPNAME      = "Enkaku"
APPVERSION_M = 0
APPVERSION_N = 1
APPVERSION_P = 0
APPVERSION   = "$(APPVERSION_M).$(APPVERSION_N).$(APPVERSION_P)"

# Application flags
APP_LOAD_FLAGS = --appFlags 0x000

# Restrict to Ed25519 curve
CURVE_APP_LOAD_PARAMS = ed25519

# Restrict to Enkaku's BIP44 path (44'/903')
# Uses wildcard for the purpose level to allow different account indices
PATH_APP_LOAD_PARAMS = "44'/903'"

# Application source
APP_SOURCE_PATH = src

# Application icons per device
ICON_NANOS   = glyphs/icon_nanos.gif
ICON_NANOX   = glyphs/icon_nanox.gif
ICON_NANOSP  = glyphs/icon_nanosp.gif
ICON_STAX    = glyphs/icon_stax_32.gif
ICON_FLEX    = glyphs/icon_flex_40.gif

# SDK features
ENABLE_BLUETOOTH = 1

# Standard Ledger SDK build rules
include $(BOLOS_SDK)/Makefile.standard_app
