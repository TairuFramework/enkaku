# Build the Enkaku Ledger app using the official Ledger app builder
#
# Usage:
#   docker build -t enkaku-ledger-app .
#   docker run --rm -v $(pwd)/bin:/app/bin enkaku-ledger-app
#
# Build for a specific device:
#   docker run --rm -e BOLOS_SDK=$NANOSP_SDK enkaku-ledger-app
#   docker run --rm -e BOLOS_SDK=$STAX_SDK enkaku-ledger-app

FROM ghcr.io/ledgerhq/ledger-app-builder/ledger-app-builder:latest

WORKDIR /app
COPY . .

RUN git init .
CMD ["bash", "-c", "BOLOS_SDK=$NANOSP_SDK COIN=ENK make"]
