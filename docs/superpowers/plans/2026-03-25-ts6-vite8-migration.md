# TypeScript 6 + Vite 8 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from TypeScript 5.9 / Vite 7 to TypeScript 6 / Vite 8 with TS 7 readiness, restructuring tsconfig hierarchy for correct type boundaries and adding test type-checking.

**Architecture:** Root `tsconfig.build.json` becomes the shared base with `types: []`, `lib: ["es2025"]`, `module: "nodenext"`. Per-package tsconfigs inherit and override only what's needed based on target environment. New `tsconfig.test.json` per package enables test type-checking. SWC stays for JS emit, tsc for declarations.

**Tech Stack:** TypeScript 6, Vite 8, Vitest (Vite 8 compatible), SWC, pnpm catalogs, Turbo

**Spec:** `docs/superpowers/specs/2026-03-25-ts6-vite8-migration-design.md`

---

### Task 1: Version Bumps

**Files:**
- Modify: `pnpm-workspace.yaml` (catalog entries)
- Modify: `package.json` (root devDependencies)

- [ ] **Step 1: Update pnpm catalog versions**

In `pnpm-workspace.yaml`, update the catalog entries:

```yaml
# Change these lines:
typescript: 5.9.2       # → typescript: ^6.0.0
vite: ^7.3.1            # → vite: ^8.0.0
vitest: ^4.1.1          # → vitest: ^<latest compatible with Vite 8>
'@vitest/ui': ^4.1.1    # → '@vitest/ui': ^<same as vitest>
```

Also check that `@vitejs/plugin-react-swc` (currently `^4.3.0`) is compatible with Vite 8. If not, update it to the latest compatible version. Similarly check `@electron-forge/plugin-vite` (currently `^7.11.1`).

Check the latest vitest version compatible with Vite 8 before updating. Run:
```bash
pnpm info vitest versions --json | tail -5
```

- [ ] **Step 2: Update root package.json**

In `package.json`, change the typescript devDependency from a direct version to use the catalog:

```jsonc
// Change:
"typescript": "^5.9.3"
// To:
"typescript": "catalog:"
```

This unifies the version under the pnpm catalog.

- [ ] **Step 3: Install dependencies**

```bash
pnpm install
```

Expect the lockfile to update. Verify no install errors.

- [ ] **Step 4: Verify TypeScript version**

```bash
pnpx tsc --version
```

Expected: `Version 6.x.x`

- [ ] **Step 5: Verify Vite version**

```bash
pnpx vite --version
```

Expected: `vite/8.x.x`

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml
git commit -m "chore: bump typescript to v6, vite to v8, vitest to latest"
```

---

### Task 2: Root tsconfig and SWC Updates

**Files:**
- Modify: `tsconfig.build.json`
- Modify: `tsconfig.json`
- Modify: `swc.json`

- [ ] **Step 1: Update `tsconfig.build.json`**

Replace the entire file with:

```json
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

Removed vs current:
- `allowSyntheticDefaultImports` (always-on in TS 6)
- `esModuleInterop` (always-on in TS 6)
- `declarationMap` (not needed)
- `"dom"` from lib (moved to per-package)
- `module` changed from `"es2022"` to `"nodenext"`
- `moduleResolution` changed from `"node"` to `"nodenext"`
- `target` changed from `"es2022"` to `"es2025"`

- [ ] **Step 2: Verify `tsconfig.json` is unchanged**

The root `tsconfig.json` should already be:

```json
{
  "extends": "./tsconfig.build.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@enkaku/*": ["packages/*"]
    },
    "noEmit": true
  }
}
```

No changes needed. Just verify it's correct.

- [ ] **Step 3: Update `swc.json`**

Change `jsc.target` from `"es2022"` to `"es2025"`:

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript"
    },
    "target": "es2025",
    "transform": {
      "optimizer": {
        "globals": {
          "vars": {
            "process.env.NODE_ENV": "production"
          }
        }
      },
      "react": {
        "runtime": "automatic"
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig.build.json swc.json
git commit -m "chore: update root tsconfig for TS 6 and SWC target to es2025"
```

---

### Task 3: Update Per-Package tsconfigs — Node Packages

**Files:**
- Modify: `packages/server/tsconfig.json`
- Modify: `packages/hub-server/tsconfig.json`
- Modify: `packages/node-keystore/tsconfig.json`
- Modify: `packages/node-streams-transport/tsconfig.json`
- Modify: `packages/socket-transport/tsconfig.json`

These packages need `types: ["node"]` because they import from `node:*` modules.

- [ ] **Step 1: Update all 5 Node package tsconfigs**

Replace each `tsconfig.json` with this template (identical for all 5):

```json
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

Changes vs current:
- Removed `"module": "NodeNext"` (now inherited from root)
- Removed `"moduleResolution": "NodeNext"` (now inherited from root)
- Added `"types": ["node"]` (TS 6 defaults types to `[]`)
- Added `"rootDir": "./src"` (TS 6 defaults rootDir to `"."`)

- [ ] **Step 2: Verify one package compiles**

```bash
cd packages/server && pnpm run build:types && cd ../..
```

Expected: succeeds, declarations in `lib/` (not `lib/src/`)

- [ ] **Step 3: Commit**

```bash
git add packages/server/tsconfig.json packages/hub-server/tsconfig.json packages/node-keystore/tsconfig.json packages/node-streams-transport/tsconfig.json packages/socket-transport/tsconfig.json
git commit -m "chore: update Node package tsconfigs for TS 6"
```

---

### Task 4: Update Per-Package tsconfigs — Browser Packages

**Files:**
- Modify: `packages/browser-keystore/tsconfig.json`
- Modify: `packages/react/tsconfig.json`

These packages need `lib: ["es2025", "dom"]` for DOM types. The `react` package also needs its `extends` path fixed (currently extends `../../tsconfig.json` which has `noEmit: true` — a pre-existing bug).

- [ ] **Step 1: Update `packages/browser-keystore/tsconfig.json`**

```json
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

- [ ] **Step 2: Update `packages/react/tsconfig.json`**

```json
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

Note: this changes `extends` from `../../tsconfig.json` to `../../tsconfig.build.json`, fixing the pre-existing `noEmit` conflict.

- [ ] **Step 3: Verify browser-keystore compiles**

```bash
cd packages/browser-keystore && pnpm run build:types && cd ../..
```

Expected: succeeds

- [ ] **Step 4: Verify react compiles**

```bash
cd packages/react && pnpm run build:types && cd ../..
```

Expected: succeeds (previously may have silently conflicted with `noEmit`)

- [ ] **Step 5: Commit**

```bash
git add packages/browser-keystore/tsconfig.json packages/react/tsconfig.json
git commit -m "chore: update browser package tsconfigs for TS 6, fix react extends"
```

---

### Task 5: Update Per-Package tsconfigs — Web API Packages

**Files:**
- Modify: `packages/http-server-transport/tsconfig.json`
- Modify: `packages/http-client-transport/tsconfig.json`
- Modify: `packages/message-transport/tsconfig.json`

These use web-standard APIs (`Request`, `Response`, `ReadableStream`, `fetch`) typed under `"dom"` in TypeScript.

- [ ] **Step 1: Update all 3 Web API package tsconfigs**

Replace each with:

```json
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

- [ ] **Step 2: Verify one compiles**

```bash
cd packages/http-server-transport && pnpm run build:types && cd ../..
```

Expected: succeeds

- [ ] **Step 3: Commit**

```bash
git add packages/http-server-transport/tsconfig.json packages/http-client-transport/tsconfig.json packages/message-transport/tsconfig.json
git commit -m "chore: update Web API package tsconfigs for TS 6"
```

---

### Task 6: Update Per-Package tsconfigs — Platform-Specific Packages

**Files:**
- Modify: `packages/expo-keystore/tsconfig.json`
- Modify: `packages/electron-keystore/tsconfig.json`
- Modify: `packages/electron-rpc/tsconfig.json`

These get types from their own dependencies (Electron, Expo), not from ambient `@types` or `lib`.

- [ ] **Step 1: Update all 3 platform-specific package tsconfigs**

Replace each with:

```json
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

- [ ] **Step 2: Verify one compiles**

```bash
cd packages/electron-keystore && pnpm run build:types && cd ../..
```

Expected: succeeds. If it fails due to missing Electron types, that's a signal to add `"types": ["electron"]` or similar — fix as needed.

- [ ] **Step 3: Commit**

```bash
git add packages/expo-keystore/tsconfig.json packages/electron-keystore/tsconfig.json packages/electron-rpc/tsconfig.json
git commit -m "chore: update platform-specific package tsconfigs for TS 6"
```

---

### Task 7: Update Per-Package tsconfigs — Environment-Agnostic Packages

**Files (21 packages):**
- Modify: `packages/async/tsconfig.json`
- Modify: `packages/capability/tsconfig.json`
- Modify: `packages/client/tsconfig.json`
- Modify: `packages/codec/tsconfig.json`
- Modify: `packages/event/tsconfig.json`
- Modify: `packages/execution/tsconfig.json`
- Modify: `packages/flow/tsconfig.json`
- Modify: `packages/generator/tsconfig.json`
- Modify: `packages/group/tsconfig.json`
- Modify: `packages/hub-client/tsconfig.json`
- Modify: `packages/hub-protocol/tsconfig.json`
- Modify: `packages/log/tsconfig.json`
- Modify: `packages/otel/tsconfig.json`
- Modify: `packages/patch/tsconfig.json`
- Modify: `packages/protocol/tsconfig.json`
- Modify: `packages/result/tsconfig.json`
- Modify: `packages/schema/tsconfig.json`
- Modify: `packages/standalone/tsconfig.json`
- Modify: `packages/stream/tsconfig.json`
- Modify: `packages/token/tsconfig.json`
- Modify: `packages/transport/tsconfig.json`

- [ ] **Step 1: Update all 21 agnostic package tsconfigs**

Replace each with:

```json
{
  "extends": "../../tsconfig.build.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./lib"
  },
  "include": ["./src/**/*"]
}
```

- [ ] **Step 2: Build all types to verify**

```bash
pnpm run build:types
```

Expected: succeeds for all packages. If any package fails due to missing types (e.g., uses `node:*` imports or web APIs), promote it to the appropriate category by adding `types: ["node"]` or `lib: ["es2025", "dom"]`.

- [ ] **Step 3: Commit**

```bash
git add packages/async/tsconfig.json packages/capability/tsconfig.json packages/client/tsconfig.json packages/codec/tsconfig.json packages/event/tsconfig.json packages/execution/tsconfig.json packages/flow/tsconfig.json packages/generator/tsconfig.json packages/group/tsconfig.json packages/hub-client/tsconfig.json packages/hub-protocol/tsconfig.json packages/log/tsconfig.json packages/otel/tsconfig.json packages/patch/tsconfig.json packages/protocol/tsconfig.json packages/result/tsconfig.json packages/schema/tsconfig.json packages/standalone/tsconfig.json packages/stream/tsconfig.json packages/token/tsconfig.json packages/transport/tsconfig.json
git commit -m "chore: update environment-agnostic package tsconfigs for TS 6"
```

---

### Task 8: Add `tsconfig.test.json` to All Packages

**Files (32 packages with test directories):**
- Create: `packages/<name>/tsconfig.test.json` for each package that has a `test/` directory

Packages WITH tests (32): `async`, `browser-keystore`, `capability`, `client`, `codec`, `electron-keystore`, `event`, `execution`, `expo-keystore`, `flow`, `generator`, `group`, `http-client-transport`, `http-server-transport`, `hub-client`, `hub-protocol`, `hub-server`, `message-transport`, `node-keystore`, `node-streams-transport`, `otel`, `patch`, `protocol`, `react`, `result`, `schema`, `server`, `socket-transport`, `standalone`, `stream`, `token`, `transport`

Packages WITHOUT tests (2): `electron-rpc`, `log` — skip these.

- [ ] **Step 1: Create `tsconfig.test.json` in all 32 packages**

Each file is identical:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["./src/**/*", "./test/**/*"]
}
```

This extends the package's source tsconfig (inheriting its `lib`/`types` settings) and adds Node types for the test runner, plus includes the `test/` directory.

- [ ] **Step 2: Verify one test config works**

```bash
cd packages/server && pnpx tsc --noEmit --skipLibCheck -p tsconfig.test.json && cd ../..
```

Expected: succeeds. If test files reference types not covered, fix the `types` array.

- [ ] **Step 3: Commit**

```bash
git add packages/*/tsconfig.test.json
git commit -m "chore: add tsconfig.test.json for test type-checking"
```

---

### Task 9: Update Package Scripts

**Files (34 packages):**
- Modify: `packages/*/package.json` (scripts section)

Two script changes across all packages:
1. `test:types`: add `-p tsconfig.test.json`
2. `build:types:ci`: remove `--declarationMap false`

- [ ] **Step 1: Update `test:types` script in all packages with tests**

Add `-p tsconfig.test.json` to each package's existing `test:types` script. **Preserve the existing `--skipLibCheck` variation** — some packages use it, others don't:

```jsonc
// Packages that currently have --skipLibCheck (e.g., server, client, async):
// From: "test:types": "tsc --noEmit --skipLibCheck"
// To:   "test:types": "tsc --noEmit --skipLibCheck -p tsconfig.test.json"

// Packages that currently do NOT have --skipLibCheck (e.g., codec, protocol, browser-keystore):
// From: "test:types": "tsc --noEmit"
// To:   "test:types": "tsc --noEmit -p tsconfig.test.json"
```

For the 2 packages without tests (`electron-rpc`, `log`), keep the old script since they have no `tsconfig.test.json`.

- [ ] **Step 2: Update `build:types:ci` script in all 34 packages**

Change in every `packages/*/package.json`:

```jsonc
// From:
"build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck --declarationMap false"
// To:
"build:types:ci": "tsc --emitDeclarationOnly --skipLibCheck"
```

- [ ] **Step 3: Verify test:types works**

```bash
cd packages/server && pnpm run test:types && cd ../..
```

Expected: succeeds, now type-checking both `src/` and `test/` files.

- [ ] **Step 4: Commit**

```bash
git add packages/*/package.json
git commit -m "chore: update package scripts for TS 6 (test tsconfig, remove declarationMap)"
```

---

### Task 10: Vite 8 and Test Config Migration

**Files:**
- Modify: `tests/e2e-web/vite.config.ts`
- Modify: `tests/e2e-web/tsconfig.app.json`
- Modify: `tests/e2e-web/tsconfig.node.json`
- Modify: `tests/e2e-electron/tsconfig.json`

- [ ] **Step 1: Migrate `tests/e2e-web/vite.config.ts`**

Replace `optimizeDeps.esbuildOptions` with Vite 8 equivalent:

```typescript
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    DEV: process.env.NODE_ENV === 'development' ? 'true' : 'false',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  optimizeDeps: {
    rolldownOptions: {
      resolve: {
        extensions: [
          '.web.js',
          '.web.jsx',
          '.web.ts',
          '.web.tsx',
          '.mjs',
          '.js',
          '.mts',
          '.ts',
          '.jsx',
          '.tsx',
          '.json',
        ],
      },
    },
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
  },
})
```

Notes:
- `esbuildOptions` → `rolldownOptions` (Vite 8 uses Rolldown)
- `resolveExtensions` → `resolve.extensions` in Rolldown format
- `loader: { '.js': 'jsx' }` is dropped — Rolldown's Oxc parser handles JSX in `.js` files by default, so no equivalent config is needed.

- [ ] **Step 2: Update `tests/e2e-web/tsconfig.app.json`**

Update targets to es2025:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2025",
    "lib": ["ES2025", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

Changes: `target` ES2022 → ES2025, `lib` ES2022 → ES2025. Removed `useDefineForClassFields` (always-on in TS 6).

- [ ] **Step 3: Update `tests/e2e-web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2025",
    "lib": ["ES2025"],
    "module": "ESNext",
    "types": [],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

Changes: `target` ES2023 → ES2025, `lib` ES2023 → ES2025.

- [ ] **Step 4: Update `tests/e2e-electron/tsconfig.json`**

Remove deprecated `esModuleInterop` and update target:

```json
{
  "compilerOptions": {
    "target": "ES2025",
    "module": "NodeNext",
    "allowJs": true,
    "skipLibCheck": true,
    "noImplicitAny": true,
    "sourceMap": true,
    "baseUrl": ".",
    "outDir": "dist",
    "moduleResolution": "nodenext",
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "strict": true
  }
}
```

Changes: removed `esModuleInterop: true`, changed `target` to ES2025.

- [ ] **Step 5: Search for any remaining `rollupOptions` usage**

```bash
grep -r "rollupOptions" tests/ packages/ --include="*.ts" --include="*.json" -l
```

If any files are found, migrate `rollupOptions` → `rolldownOptions`.

- [ ] **Step 6: Verify vitest configs still work**

The vitest configs at `packages/react/vitest.config.ts`, `packages/hub-server/vitest.config.ts`, and `tests/integration/vitest.config.ts` use the standard `defineConfig` from `vitest/config` — no changes needed, but verify they work:

```bash
cd packages/react && pnpm run test:unit && cd ../..
```

- [ ] **Step 7: Commit**

```bash
git add tests/e2e-web/vite.config.ts tests/e2e-web/tsconfig.app.json tests/e2e-web/tsconfig.node.json tests/e2e-electron/tsconfig.json
git commit -m "chore: migrate Vite 8 config and update test tsconfigs"
```

---

### Task 11: CI Workflow Update

**Files:**
- Modify: `.github/workflows/build-test.yml`

- [ ] **Step 1: Add TS 7 readiness check**

Add a new step after "Unit tests" in `.github/workflows/build-test.yml`:

```yaml
      - name: TS 7 readiness check
        run: pnpx tsc --noEmit --stableTypeOrdering
```

Before adding, verify the flag exists in TS 6:

```bash
pnpx tsc --help | grep stableTypeOrdering
```

If the flag doesn't exist, skip this step and leave a TODO comment in the workflow.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build-test.yml
git commit -m "ci: add TS 7 readiness check with --stableTypeOrdering"
```

---

### Task 12: Full Build Verification

- [ ] **Step 1: Clean all build artifacts**

```bash
pnpm run -r build:clean
```

- [ ] **Step 2: Run full build**

```bash
pnpm run build
```

Expected: all 34 packages build successfully. Declarations land in `lib/` (not `lib/src/`).

If any package fails:
- Missing Node types → add `"types": ["node"]` to that package's tsconfig
- Missing DOM/web API types → add `"lib": ["es2025", "dom"]`
- SWC `es2025` not supported → check SWC docs, use closest supported target or update SWC

- [ ] **Step 3: Verify declaration output paths for ALL packages**

```bash
for pkg in packages/*/; do test -f "$pkg/lib/index.d.ts" && echo "OK: $pkg" || echo "FAIL: $pkg"; done
```

Expected: all packages show `OK`. If any show `FAIL`, check that `rootDir: "./src"` is set in that package's `tsconfig.json` — without it, declarations land in `lib/src/` instead of `lib/`.

- [ ] **Step 4: Run all unit tests**

```bash
pnpm run test
```

Expected: all tests pass. Fix any failures caused by the migration.

- [ ] **Step 5: Run integration tests**

```bash
cd tests/integration && pnpm run test && cd ../..
```

Expected: all integration tests pass.

- [ ] **Step 6: Run linting**

```bash
pnpm run lint
```

Expected: passes. Biome should be unaffected by TS version changes.

- [ ] **Step 7: Commit any fixes**

If any fixes were needed during verification, review `git status` and stage specific files:

```bash
git status
git add packages/ tests/ tsconfig.build.json swc.json .github/
git commit -m "fix: resolve TS 6 migration issues found during verification"
```

---

### Task 13: Final Verification and Squash (Optional)

- [ ] **Step 1: Run full CI-equivalent pipeline**

```bash
pnpm run lint && pnpm run test && cd tests/integration && pnpm run test && cd ../..
```

Expected: everything green.

- [ ] **Step 2: Review all changes**

```bash
git log --oneline main..HEAD
git diff main --stat
```

Verify:
- No unintended file changes
- All 34 package tsconfigs updated
- 32 `tsconfig.test.json` files created
- Root configs updated
- Scripts updated
- CI updated
