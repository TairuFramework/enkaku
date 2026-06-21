# Ported tests (not part of this workspace)

These tests moved out of `tests/*` because the code they exercise left `@enkaku`.
They are kept verbatim (deps rewired to the new scopes) to be re-homed, then deleted here.

- `e2e-expo/`, `integration-mls/` → `@kumiai` (awaiting `@kumiai` publish)
- `ledger/` → `@kokuin` (owns the keystores + the BOLOS firmware)

This directory is nested below `tests/` so it falls outside the `tests/*`
workspace glob: not installed, not built, not run.
