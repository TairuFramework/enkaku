# Enkaku Ledger App - Makefile

ifeq ($(BOLOS_SDK),)
$(error Environment variable BOLOS_SDK is not set)
endif

include $(BOLOS_SDK)/Makefile.defines

APPNAME      = "Enkaku"
APPVERSION_M = 0
APPVERSION_N = 1
APPVERSION_P = 0
APPVERSION   = "$(APPVERSION_M).$(APPVERSION_N).$(APPVERSION_P)"

APP_SOURCE_PATH += src

CURVE_APP_LOAD_PARAMS = ed25519
PATH_APP_LOAD_PARAMS  = "44'/903'"

VARIANT_PARAM  = COIN
VARIANT_VALUES = ENK

ENABLE_BLUETOOTH = 1

include $(BOLOS_SDK)/Makefile.standard_app
