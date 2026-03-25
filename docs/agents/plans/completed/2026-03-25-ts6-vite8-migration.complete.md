# TypeScript 6 + Vite 8 Migration

**Status:** complete
**Date:** 2026-03-25
**Branch:** chore/ts-6

## Goal

Migrate from TypeScript 5.9 / Vite 7 to TypeScript 6 / Vite 8 with TS 7 (native port) readiness. Restructure tsconfig hierarchy for correct type boundaries and add test type-checking.

## Key Design Decisions

- **Structured migration (Approach B):** Update versions AND restructure tsconfig hierarchy for correctness, without changing the build pipeline (SWC for JS emit, tsc for declarations only).
- **`moduleResolution: "nodenext"`** in the shared base -- strictest ESM enforcement, all packages already used `.js` extensions.
- **`types: []` default** with per-package overrides -- Node packages get `types: ["node"]`, browser/web API packages get `lib: ["es2025", "dom"]`, agnostic packages inherit nothing.
- **Removed `dom` from shared base** -- only packages that actually need DOM/Web API types declare them.
- **`tsconfig.test.json` per package** -- tests are now type-checked (they never were before). All test configs include `types: ["node"]` since tests always run in Node via Vitest.
- **SWC target: `esnext`** -- `es2025` is not a valid SWC target; `esnext` avoids unnecessary downleveling on Node 24+.
- **TS 7 readiness via `--stableTypeOrdering`** in CI (continue-on-error until existing issues resolved).
- **No `declarationMap`** -- IDE navigation handled by path aliases; declaration maps were already disabled in CI.
- **Removed deprecated options:** `esModuleInterop`, `allowSyntheticDefaultImports`, `baseUrl` (replaced with relative `paths`), `useDefineForClassFields`.

## What Was Built

- Root `tsconfig.build.json` restructured as shared base with `nodenext`/`es2025`/`types: []`
- All 34 package tsconfigs updated with `rootDir: "./src"` and environment-appropriate overrides
- 32 `tsconfig.test.json` files created, `test:types` scripts updated
- Fixed `react` package tsconfig `extends` bug (was pointing to IDE config with `noEmit`)
- Fixed `canonicalize` CJS/ESM interop for `nodenext` in `react/client.ts`
- Fixed pre-existing type errors in 17 packages' test files
- Migrated `e2e-web` vite config from `esbuildOptions` to `rolldownOptions`
- Updated e2e tsconfigs (removed deprecated options, bumped targets)
- CI workflow: added `--stableTypeOrdering` TS 7 readiness check

## Deviations from Plan

- Many more packages needed `dom` lib than anticipated -- Web Streams APIs (`ReadableStream`, `WritableStream`, `TransformStream`) and web globals (`AbortController`, `TextEncoder`, `atob`) are used pervasively.
- Three packages (`async`, `flow`, `execution`, `generator`) need `esnext.disposable` for `Disposable`/`AsyncDisposable` which are not yet in `es2025` lib definitions.
- Expo SDK has a peer dependency on `typescript: ^5.0.0` -- unmet with TS 6, needs separate resolution.
