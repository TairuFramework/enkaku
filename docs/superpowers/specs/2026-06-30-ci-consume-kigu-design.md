# Enkaku CI: Consume Kigu Reusable Workflows

**Date:** 2026-06-30
**Status:** Approved design

## Goal

Refactor Enkaku's CI to consume the centralized reusable workflows published by
`TairuFramework/kigu`, mirroring how `kokuin` already does it. This removes
duplicated workflow YAML and a stale local composite action, so CI improvements
made in kigu propagate to Enkaku automatically.

## Background

- **kigu** is the central CI framework repo. It publishes:
  - A `setup` composite action at `TairuFramework/kigu/setup@main`
    (pnpm + node + install + optional build).
  - Reusable `workflow_call` workflows under
    `TairuFramework/kigu/.github/workflows/`: `build-test.yml`, `e2e-web.yml`,
    `e2e-desktop.yml`, `e2e-ios.yml`, `e2e-android.yml`.
- **kokuin** consumes these as thin wrapper workflows that only declare triggers
  and `uses:` the kigu reusable workflow with inputs.
- **enkaku** currently carries its own full copies of `build-test.yml`,
  `e2e-web.yml`, `e2e-desktop.yml`, `e2e-android.yml`, `e2e-ios.yml`, plus a
  local `.github/actions/setup-environment` composite action (older: pnpm
  `action-setup@v4`, always builds).

### Scope findings

- enkaku's `e2e-android.yml` and `e2e-ios.yml` reference `tests/e2e-expo`, which
  **does not exist** — enkaku has no mobile/expo app. These two workflows are
  copy-paste cruft.
- enkaku's real test surfaces: `tests/integration` (vitest), `tests/e2e-web`
  (Playwright), `tests/e2e-electron` (desktop), `tests/deno`.
- kigu provides **no** deno reusable workflow.

## Decisions

1. **Deno:** skip deno CI for now (status quo — no workflow). Revisit later.
2. **E2E scope:** keep web + desktop only; drop android/ios.
3. **Pinning:** reference kigu workflows at `@main`, matching kokuin.
4. **Triggers:** adopt kokuin's pattern — `push` on `main` only + `pull_request`
   (replaces enkaku's current all-branches `[push, pull_request]`). Stops
   double-runs on PR branches.

## Changes

### Replace (thin wrappers at `@main`)

**`.github/workflows/build-test.yml`**
```yaml
name: Build and test
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build-test:
    uses: TairuFramework/kigu/.github/workflows/build-test.yml@main
    with:
      node-versions: '[24, 26]'
      integration-tests-dir: tests/integration
      ts-readiness-check: true
```

**`.github/workflows/e2e-web.yml`**
```yaml
name: Web E2E
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    uses: TairuFramework/kigu/.github/workflows/e2e-web.yml@main
    with:
      working-directory: tests/e2e-web
      node-version: '24'
```

**`.github/workflows/e2e-desktop.yml`**
```yaml
name: Desktop E2E
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    uses: TairuFramework/kigu/.github/workflows/e2e-desktop.yml@main
    with:
      working-directory: tests/e2e-electron
      node-version: '24'
```

### Delete

- `.github/workflows/e2e-android.yml` (targets nonexistent `tests/e2e-expo`)
- `.github/workflows/e2e-ios.yml` (targets nonexistent `tests/e2e-expo`)
- `.github/actions/setup-environment/` (replaced by `TairuFramework/kigu/setup@main`)

## Behavior changes vs current

1. Triggers move from all-branches to `main` push + PR (decision 4).
2. Integration tests run inside kigu's `build-test` via the
   `integration-tests-dir` input rather than a separate inline step — same
   effect (`pnpm run test` in `tests/integration`).
3. pnpm setup upgrades `action-setup@v4` → `@v6` (kigu's `setup` action).
4. kigu's reusable workflows add `concurrency` (cancel-in-progress),
   `timeout-minutes`, `permissions: contents: read`, and Playwright browser
   caching — improvements inherited for free.

## Out of scope

- Deno CI.
- `tests/integration` contents, package.json scripts, any source code.
- Changes to the kigu repo.

## Verification

- Run `actionlint` on the three new workflow files locally before commit.
- Confirm the three wrapper workflows resolve their `uses:` targets (kigu
  reusable workflows exist at `@main`).
- After push: confirm GitHub Actions shows Build and test / Web E2E / Desktop
  E2E running, and no android/ios jobs.
