# TypeScript 6 + Vite 8 Migration Design

## Goal

Migrate the Enkaku monorepo from TypeScript 5.9 / Vite 7 to TypeScript 6 / Vite 8, with TS 7 (native port) readiness. Clean up the tsconfig hierarchy to enforce correct type boundaries between Node, browser, and environment-agnostic packages. Add test type-checking.

## Approach

Structured migration (Approach B): update all versions AND restructure the tsconfig hierarchy for correctness and TS 7 readiness, without changing the build pipeline (SWC stays for JS emit, tsc stays for declarations only).

## 1. tsconfig Hierarchy

### Root `tsconfig.build.json` — shared compiler base

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "target": "es2025",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["es2025"],
    "types": [],
    "declaration": true,
    "jsx": "react-jsx",
    "noUncheckedSideEffectImports": true
  }
}
```

Removed from current config:
- `declarationMap` — IDE navigation handled by path aliases; not shipped to consumers
- `esModuleInterop` — always-on in TS 6
- `allowSyntheticDefaultImports` — always-on in TS 6
- `"dom"` from `lib` — only browser/web-API packages should have DOM types

Note: `module` changes from `"es2022"` to `"nodenext"`. This enforces `.js` extension requirements in imports and `package.json` `exports` field resolution. All 34 packages already use `.js` extensions in relative imports and have proper `exports` fields, so this should be safe. Validate during implementation.

### Root `tsconfig.json` — IDE / workspace type-checking

```jsonc
{
  "extends": "./tsconfig.build.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@enkaku/*": ["packages/*"] },
    "noEmit": true
  }
}
```

Unchanged in structure. `baseUrl` is deprecated as a module resolution root in TS 6, but required for `paths` — kept as-is.

### Per-package `tsconfig.json` — source compilation

All variants include `rootDir: "./src"` — required because TS 6 changes the `rootDir` default from "inferred common root" to `"."` (tsconfig directory). Without this, declarations would be emitted to `lib/src/` instead of `lib/`, breaking all `"types": "lib/index.d.ts"` entries.

**Node packages** — add `types: ["node"]`:

```jsonc
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

**Browser packages** — add `lib: ["es2025", "dom"]`:

```jsonc
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "lib": ["es2025", "dom"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

**Web API packages** — use `Request`/`Response`/`ReadableStream`/`fetch` (web-standard APIs available in Node 18+, browsers, Deno, Bun — but TypeScript bundles them under `"dom"` lib):

```jsonc
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "lib": ["es2025", "dom"],
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

**Environment-agnostic packages** — inherit base as-is:

```jsonc
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

### Per-package `tsconfig.test.json` — test type-checking (new)

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["./src/**/*", "./test/**/*"]
}
```

All tests run in Node (via Vitest), so all test configs get `types: ["node"]`. Extends the package's own tsconfig so source types are inherited correctly. All test files use explicit `import { describe, test, expect } from 'vitest'` — no ambient globals needed.

### Fix: `react` package tsconfig

The `react` package currently extends `../../tsconfig.json` (IDE config with `noEmit: true`) instead of `../../tsconfig.build.json`. This is a pre-existing bug — `noEmit` conflicts with `tsc --emitDeclarationOnly`. Fix as part of this migration by switching to extend `../../tsconfig.build.json` like all other packages.

## 2. Package Categorization

### Node packages — `types: ["node"]`

- `server`
- `hub-server`
- `node-keystore`
- `node-streams-transport`
- `socket-transport` (imports `node:net`)

### Browser packages — `lib: ["es2025", "dom"]`

- `browser-keystore`
- `react`

### Web API packages — `lib: ["es2025", "dom"]`

Packages that use web-standard APIs (`Request`, `Response`, `ReadableStream`, `fetch`) which TypeScript types under the `"dom"` lib. These are environment-agnostic at runtime but need DOM types for compilation.

- `http-server-transport`
- `http-client-transport`
- `message-transport` (if it uses `MessagePort`/`MessageChannel`)

### Platform-specific packages — no overrides

Packages whose types come from their own dependencies (e.g., `electron`, `expo-crypto`), not ambient `@types` or `lib`.

- `expo-keystore`
- `electron-keystore`
- `electron-rpc`

### Environment-agnostic — no overrides (inherit base)

- `async`, `capability`, `client`, `codec`, `event`, `execution`, `flow`, `generator`, `group`, `hub-client`, `hub-protocol`, `log`, `otel`, `patch`, `protocol`, `result`, `schema`, `standalone`, `stream`, `token`, `transport`

**Rule:** if `tsc` complains about missing types in an agnostic package during implementation, promote it to the appropriate category. No guessing upfront.

## 3. Version Bumps

### pnpm catalog

| Package | Current | Target |
|---------|---------|--------|
| `typescript` | 5.9.3 | 6.x (latest) |
| `vite` | 7.3.1 | 8.x (latest) |
| `vitest` | 4.1.1 | compatible with Vite 8 (latest) |

Note: the pnpm catalog currently lists `typescript: 5.9.2` while root `package.json` has `^5.9.3`. Unify under the catalog entry for TS 6.

### `swc.json`

Bump `jsc.target` from `"es2022"` to `"es2025"`. Verify that `@swc/core` 1.15.x supports this target value — if not, update SWC or use the closest supported target.

### Vite 8 specifics

- `tests/e2e-web/vite.config.ts`: migrate `optimizeDeps.esbuildOptions` (with `resolveExtensions` and `loader` configs) to `optimizeDeps.rolldownOptions` equivalents
- Vitest configs (`packages/react/vitest.config.ts`, `packages/hub-server/vitest.config.ts`, `tests/integration/vitest.config.ts`) are minimal — version bump only
- If any configs use `build.rollupOptions`, migrate to `build.rolldownOptions`

## 4. Deprecated Options Cleanup

Remove from `tsconfig.build.json`:
- `allowSyntheticDefaultImports: true` — always-on in TS 6
- `esModuleInterop: true` — always-on in TS 6
- `declarationMap: true` — not needed (IDE uses path aliases, CI already disabled it)

Remove from all other tsconfig files in the repo:
- `esModuleInterop: true` in `tests/e2e-electron/tsconfig.json`
- Any other deprecated options found in `tests/e2e-web/` tsconfigs

Update `tests/e2e-web/` and `tests/e2e-electron/` tsconfigs to use `target: "es2025"` and `lib: ["es2025"]` for consistency.

No `ignoreDeprecations: "6.0"` — clean migration, fix warnings instead of suppressing.

## 5. Script Updates

### Per-package `package.json`

```jsonc
{
  "scripts": {
    "build:clean": "del lib",
    "build:js": "swc src -d ./lib --config-file ../../swc.json --strip-leading-paths",
    "build:types": "tsc --emitDeclarationOnly --skipLibCheck",
    "build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck",
    "build": "pnpm run build:clean && pnpm run build:js && pnpm run build:types",
    "test:types": "tsc --noEmit --skipLibCheck -p tsconfig.test.json",
    "test:unit": "vitest run",
    "test": "pnpm run test:types && pnpm run test:unit",
    "prepublishOnly": "pnpm run build"
  }
}
```

Changes:
- `test:types` now uses `-p tsconfig.test.json` to type-check tests too
- `build:types:ci` drops `--declarationMap false` (no longer in config)

### CI workflow

Add a step running `tsc --noEmit --stableTypeOrdering` against root tsconfig for TS 7 readiness validation. This has ~25% perf cost — CI only, not in dev or pre-commit. Verify that `--stableTypeOrdering` is available in the targeted TS 6 version before adding.

### Pre-commit hook

No changes — runs `pnpm biome check` and `pnpm run build:types`, both still valid.

## 6. Module Resolution Strategy

Primary: `moduleResolution: "nodenext"` everywhere. This is the strictest ESM enforcement and matches the existing package-level configs and import conventions (`.js` extensions already used). All packages have proper `exports` fields in `package.json`.

Fallback: if `"nodenext"` causes issues with the root IDE config or specific packages, switch to `"bundler"` where needed.

## 7. TS 7 Readiness

- All options deprecated in TS 6 are removed (not suppressed with `ignoreDeprecations`)
- `--stableTypeOrdering` runs in CI to detect type ordering differences with the TS 7 native port
- `types: []` default is explicit (matches TS 6 and TS 7 behavior)
- No use of removed module formats (`amd`, `umd`, `systemjs`)
- No use of `--outFile`, `--moduleResolution classic`, or other removed options

## 8. Out of Scope

- Replacing SWC with `tsc --build` project references (defer to TS 7 native port)
- Adding composite project references
- Restructuring the build pipeline beyond config changes
- `website/` tsconfig (managed by Docusaurus)
- `tests/deno/` config (managed by Deno)
