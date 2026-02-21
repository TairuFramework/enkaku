# Pre-commit Hooks Design

## Summary

Add a pre-commit hook to the Enkaku repo that runs linting on staged files and a full type check before each commit. Zero new dependencies — uses a plain git hook script with biome's built-in `--staged` flag.

## Approach

**Plain git hook script** over husky/lint-staged/lefthook because:

- Biome's `--staged` flag eliminates the need for lint-staged
- `git config core.hooksPath` eliminates the need for husky
- Zero new dependencies for a ~10-line shell script

## Components

### Hook Script (`.githooks/pre-commit`)

A shell script that runs two checks sequentially:

1. `biome check --staged --no-errors-on-unmatched` — format and lint only staged files
2. `pnpm run build:types` — full type check across all packages

Exits early on first failure to give clear feedback. Commit is blocked if either step fails.

### Auto-configuration

A `prepare` lifecycle script in the root `package.json`:

```json
"prepare": "git config core.hooksPath .githooks"
```

Runs automatically after `pnpm install` so contributors get hooks configured without manual steps.

### Skip Escape Hatch

Git's built-in `--no-verify` flag. No custom implementation needed.

## Changes

- **1 new directory:** `.githooks/`
- **1 new file:** `.githooks/pre-commit` (~10 lines)
- **1 edit:** add `prepare` script to root `package.json`
- **0 new dependencies**
