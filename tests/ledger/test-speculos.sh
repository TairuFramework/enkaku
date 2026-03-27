#!/usr/bin/env bash
set -euo pipefail

# Automated Speculos integration test runner.
#
# Builds the Ledger C app, starts the Speculos emulator, runs the
# integration tests in tests/ledger/, then tears down.
#
# Usage:
#   ./tests/ledger/test.sh              # Emulator + tests (builds only if needed)
#   ./tests/ledger/test.sh --build      # Force rebuild before testing
#   ./tests/ledger/test.sh --keep       # Don't stop Speculos after tests
#
# Environment:
#   SPECULOS_PORT  API port (default: 9999)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_DIR="$REPO_ROOT/apps/ledger"
SPECULOS_PORT="${SPECULOS_PORT:-9999}"
SPECULOS_URL="http://127.0.0.1:${SPECULOS_PORT}"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

FORCE_BUILD=false
KEEP=false

for arg in "$@"; do
  case "$arg" in
    --build) FORCE_BUILD=true ;;
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

# Step 1: Build the app (only if ELF missing or --build flag)
if [ "$FORCE_BUILD" = true ] || [ ! -f "$APP_DIR/bin/app.elf" ]; then
  echo "Building Ledger app..."
  docker compose -f "$COMPOSE_FILE" run --rm build
else
  echo "Using existing apps/ledger/bin/app.elf (use --build to force rebuild)"
fi

if [ ! -f "$APP_DIR/bin/app.elf" ]; then
  echo "Error: apps/ledger/bin/app.elf not found. Build failed."
  exit 1
fi

# Step 2: Start Speculos
echo "Starting Speculos emulator on port ${SPECULOS_PORT}..."
docker compose -f "$COMPOSE_FILE" up -d speculos

# Step 3: Wait for API
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
echo "Running Ledger integration tests..."
cd "$SCRIPT_DIR"
SPECULOS_URL="${SPECULOS_URL}" vitest run speculos.test.ts

echo "All tests passed."
