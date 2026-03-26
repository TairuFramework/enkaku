#!/usr/bin/env bash
set -euo pipefail

# Automated Speculos test runner for the Enkaku Ledger app.
#
# Usage:
#   ./apps/ledger/test.sh              # Build, start emulator, run tests, stop
#   ./apps/ledger/test.sh --no-build   # Skip build, assume bin/app.elf exists
#   ./apps/ledger/test.sh --keep       # Don't stop Speculos after tests
#
# Environment:
#   SPECULOS_PORT  API port (default: 5000)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SPECULOS_PORT="${SPECULOS_PORT:-5000}"
SPECULOS_URL="http://127.0.0.1:${SPECULOS_PORT}"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

NO_BUILD=false
KEEP=false

for arg in "$@"; do
  case "$arg" in
    --no-build) NO_BUILD=true ;;
    --keep) KEEP=true ;;
  esac
done

cleanup() {
  if [ "$KEEP" = false ]; then
    echo "Stopping Speculos..."
    docker compose -f "$COMPOSE_FILE" down --timeout 5 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Step 1: Build the app
if [ "$NO_BUILD" = false ]; then
  echo "Building Ledger app..."
  docker compose -f "$COMPOSE_FILE" run --rm build
fi

# Verify the ELF exists
if [ ! -f "$SCRIPT_DIR/bin/app.elf" ]; then
  echo "Error: bin/app.elf not found. Build may have failed."
  exit 1
fi

# Step 2: Start Speculos
echo "Starting Speculos emulator on port ${SPECULOS_PORT}..."
docker compose -f "$COMPOSE_FILE" up -d speculos

# Step 3: Wait for API to be ready
echo -n "Waiting for Speculos API"
RETRIES=30
until curl -sf "${SPECULOS_URL}/events?currentscreenonly=true" > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo " FAILED"
    echo "Speculos did not start within 30 seconds."
    docker compose -f "$COMPOSE_FILE" logs speculos
    exit 1
  fi
  echo -n "."
  sleep 1
done
echo " ready"

# Step 4: Run integration tests
echo "Running integration tests..."
cd "$REPO_ROOT"
SPECULOS_URL="${SPECULOS_URL}" pnpm --filter=@enkaku/ledger-identity run test:unit

echo "All tests passed."
