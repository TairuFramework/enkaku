# Pre-commit Hooks

**Status:** Complete

## Summary

Added a pre-commit hook that runs biome lint on staged files and a full type check before each commit. Zero new dependencies — uses a plain git hook script with biome's built-in `--staged` flag.

## Approach

Plain git hook script chosen over husky/lint-staged/lefthook because:

- Biome's `--staged` flag eliminates the need for lint-staged
- `git config core.hooksPath` eliminates the need for husky
- Zero new dependencies for a simple shell script

## What Was Built

### Hook Script (`.githooks/pre-commit`)

Runs two checks sequentially, exits early on first failure:

1. `pnpm biome check --write --staged --no-errors-on-unmatched` — format and lint staged files, auto-fixing where possible
2. `pnpm run build:types` — full type check across all packages

### Auto-configuration (`package.json`)

A `prepare` lifecycle script (`git config core.hooksPath .githooks`) runs automatically on `pnpm install`, so contributors get hooks configured without manual steps.

### Bypass

Git's built-in `--no-verify` flag for skipping the hook when needed.

## Changes

- Created `.githooks/pre-commit`
- Added `prepare` script to root `package.json`
