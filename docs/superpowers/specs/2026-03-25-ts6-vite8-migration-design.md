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
- `"dom"` from `lib` — only browser packages should have DOM types

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

Three variants depending on target environment:

**Node packages** — add `types: ["node"]`:

```jsonc
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "types": ["node"],
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

All tests run in Node (via Vitest), so all test configs get `types: ["node"]`. Extends the package's own tsconfig so source types are inherited correctly.

## 2. Package Categorization

### Node packages — `types: ["node"]`

- `server`
- `hub-server`
- `node-keystore`
- `node-streams-transport`
- `hub-client` (if needed)

### Browser packages — `lib: ["es2025", "dom"]`

- `browser-keystore`
- `react`

### React Native packages — no overrides

- `expo-keystore`
- `electron-keystore`
- `electron-rpc`

### Environment-agnostic — no overrides (inherit base)

- `async`, `capability`, `client`, `codec`, `event`, `execution`, `flow`, `generator`, `group`, `http-client-transport`, `http-server-transport`, `hub-protocol`, `log`, `message-transport`, `otel`, `patch`, `protocol`, `result`, `schema`, `socket-transport`, `standalone`, `stream`, `token`, `transport`

**Rule:** if `tsc` complains about missing types in an agnostic package during implementation, promote it to the Node category. No guessing upfront.

## 3. Version Bumps

### pnpm catalog

| Package | Current | Target |
|---------|---------|--------|
| `typescript` | 5.9.3 | 6.x (latest) |
| `vite` | 7.3.1 | 8.x (latest) |
| `vitest` | 4.1.1 | compatible with Vite 8 (latest) |

### `swc.json`

Bump `jsc.target` from `"es2022"` to `"es2025"`.

### Vite 8 specifics

- `esbuild.*` config → `oxc.*` equivalents (if any exist)
- `build.rollupOptions` → `build.rolldownOptions` (if any exist)
- Current vitest configs are minimal — mostly just the version bump

## 4. Deprecated Options Cleanup

Remove from `tsconfig.build.json`:
- `allowSyntheticDefaultImports: true` — always-on in TS 6
- `esModuleInterop: true` — always-on in TS 6
- `declarationMap: true` — not needed (IDE uses path aliases, CI already disabled it)

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

Add a step running `tsc --noEmit --stableTypeOrdering` against root tsconfig for TS 7 readiness validation. This has ~25% perf cost — CI only, not in dev or pre-commit.

### Pre-commit hook

No changes — runs `pnpm biome check` and `pnpm run build:types`, both still valid.

## 6. Module Resolution Strategy

Primary: `moduleResolution: "nodenext"` everywhere. This is the strictest ESM enforcement and matches the existing package-level configs and import conventions (`.js` extensions already used).

Fallback: if `"nodenext"` causes issues with the root IDE config or specific packages, switch to `"bundler"` where needed.

## 7. TS 7 Readiness

- All options deprecated in TS 6 are removed (not suppressed with `ignoreDeprecations`)
- `--stableTypeOrdering` runs in CI to detect type ordering differences with the TS 7 native port
- `types: []` default is explicit (matches TS 6 and TS 7 behavior)
- No use of removed module formats (`amd`, `umd`, `systemjs`)
- No use of `--outFile`, `--moduleResolution classic`, or other removed options

## Non-Goals

- Replacing SWC with `tsc --build` project references (defer to TS 7 native port)
- Adding composite project references
- Restructuring the build pipeline beyond config changes
