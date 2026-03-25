# TS 6 Migration Follow-ups

## Expo SDK TS 6 compatibility

Expo (`@expo/require-utils`) has a peer dependency on `typescript: ^5.0.0` which is unmet with TS 6. Update Expo SDK or wait for Expo to release TS 6 support.

## TS 7 readiness: fix --stableTypeOrdering issues

The `--stableTypeOrdering` CI step runs with `continue-on-error: true`. Some packages have type ordering differences that TS 7's native port would resolve differently. Fix these and remove `continue-on-error`.

## Move Disposable types to es2025 lib

`esnext.disposable` is used for `Disposable`/`AsyncDisposable` in `async`, `flow`, `execution`, `generator`. When a future TS version includes these in `es2025` or `es2026`, remove the `esnext.disposable` overrides.

## @electron-forge/plugin-vite Vite 8 deprecation warning

`@electron-forge/plugin-vite` v7.11.1 uses `inlineDynamicImports: true` in its internal preload config, which is deprecated in Vite 8/Rolldown (should be `codeSplitting: false`). This produces a warning at build time. Only alpha versions of v8 exist (`8.0.0-alpha.6`). Wait for a stable release and bump in the pnpm catalog.
