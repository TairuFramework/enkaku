# Enkaku Phase 2 Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim `@enkaku` to RPC-only — delete the 29 packages (+ `apps/ledger`) that moved to `@sozai`/`@kokuin`/`@kumiai`, rewire surviving tests, park the tests bound for other repos, and remove Phase-1 migration cruft.

**Architecture:** Clear every workspace reference to a doomed package first (rewire kept tests to published `@kokuin`; park `@kumiai`/firmware-bound tests out of the `tests/*` glob), then delete the packages, then prune config. Each task ends with the workspace green.

**Tech Stack:** pnpm workspaces, turbo, swc, tsc, biome, changesets, vitest.

## Global Constraints

- **Branch:** `chore/stack-refactoring` (continue Phase 1 — do NOT create a new branch; do NOT merge to main).
- **Keep exactly these 12 RPC packages:** `protocol`, `transport`, `client`, `server`, `standalone`, `http-fetch`, `http-serve`, `socket`, `node-streams`, `message`, `electron`, `react`. Delete every other `packages/*`.
- **Cross-repo dep ranges:** `@sozai/*` and `@kokuin/*` → `^0.1.0`. `@kumiai/*` → `^0.1.0` (unpublished; only ever written into parked, non-installed package.json). Kept `@enkaku/*` RPC deps stay `workspace:^`/`workspace:*` as already present.
- **No keystore re-export** in `@enkaku/protocol` (Phase 1 removed `KeyEntry`/`KeyStore`; do not reintroduce).
- **Parked dir:** `tests/_ported/` is nested two levels below `tests/`, outside the single-level `tests/*` workspace glob — excluded from install and the gate.
- **Gate (each task ends green; final task runs all):** `pnpm install` → `pnpm run build` → `pnpm run test` → `rtk proxy pnpm run lint`, all exit 0. (`rtk proxy` prefix is required for lint in this repo.)
- **Naming/style guardrails (AGENTS.md):** `type` not `interface`; `ID`/`HTTP`/`JWT` casing; `Array<T>` not `T[]`; no `any`; `pnpm` not `npm`. Do not edit generated files (`.gen.ts`, `__generated__/`, `lib/`).
- **Deferred, do NOT touch:** `website/`, `docs/` (typedoc regen later), `tests/deno`, downstream `mokei`/`kubun`.

## Rename maps (used throughout)

```
# core → @sozai          identity → @kokuin              MLS → @kumiai
expo-runtime → runtime-expo   expo-keystore → expo        group → mls
                              browser-keystore → browser   hub-client → hub-client
                              electron-keystore → electron hub-protocol → hub-protocol
                              hd-keystore → deterministic  hub-server → hub-server
                              ledger-identity → ledger-device hub-tunnel → hub-tunnel
                              token → token
```

**29 packages to delete** (`packages/`):
`async codec event execution flow generator log otel patch result runtime schema stream expo-runtime token capability browser-keystore node-keystore electron-keystore expo-keystore hd-keystore ledger-identity broadcast group group-rpc hub-client hub-protocol hub-server hub-tunnel`

---

### Task 1: Park the @kumiai- and @kokuin-bound tests out of the workspace

Run this **before** any package deletion so the moved files stop being workspace-resolved while their packages still exist. Parked package.json files are documentary (never installed); rewire their deps anyway so they are port-ready.

**Files:**
- Create: `tests/_ported/README.md`
- Move: `tests/e2e-expo/` → `tests/_ported/e2e-expo/`
- Move: `tests/ledger/` → `tests/_ported/ledger/`
- Move: `tests/integration/hub-agent-scenarios.test.ts` + `tests/integration/hub-tunnel-echo.test.ts` → `tests/_ported/integration-mls/`
- Create: `tests/_ported/integration-mls/package.json`, `tests/_ported/integration-mls/vitest.config.ts`
- Modify: `tests/integration/package.json` (strip MLS deps)

- [ ] **Step 1: Create the parked dir and move the directories**

```bash
mkdir -p tests/_ported/integration-mls
git mv tests/e2e-expo tests/_ported/e2e-expo
git mv tests/ledger tests/_ported/ledger
git mv tests/integration/hub-agent-scenarios.test.ts tests/_ported/integration-mls/hub-agent-scenarios.test.ts
git mv tests/integration/hub-tunnel-echo.test.ts tests/_ported/integration-mls/hub-tunnel-echo.test.ts
```

If `git mv` on a directory errors because of untracked `node_modules`, the symlinked `node_modules` is git-ignored and not tracked — re-run targeting only tracked files (`git mv` moves tracked content; leftover empty `node_modules` symlinks can be deleted with `rm`).

- [ ] **Step 2: Rewire `tests/_ported/e2e-expo` deps + imports**

`tests/_ported/e2e-expo/package.json` dependencies — replace the four `@enkaku/*` entries (all `workspace:^`) with:
```json
"@kokuin/expo": "^0.1.0",
"@sozai/runtime-expo": "^0.1.0",
"@kumiai/mls": "^0.1.0",
"@kokuin/token": "^0.1.0",
```
Imports:
- `tests/_ported/e2e-expo/index.ts`: `@enkaku/expo-runtime` → `@sozai/runtime-expo`
- `tests/_ported/e2e-expo/components/SignVerify.tsx`: `@enkaku/expo-keystore` → `@kokuin/expo`; `@enkaku/token` → `@kokuin/token`
- `tests/_ported/e2e-expo/components/GroupEncryption.tsx`: `@enkaku/group` → `@kumiai/mls`; `@enkaku/token` → `@kokuin/token`

- [ ] **Step 3: Rewire `tests/_ported/ledger` deps + imports**

`tests/_ported/ledger/package.json` devDependencies — replace the three `@enkaku/*` entries with:
```json
"@kokuin/deterministic": "^0.1.0",
"@kokuin/ledger-device": "^0.1.0",
"@kokuin/token": "^0.1.0",
```
In every `.ts` file under `tests/_ported/ledger/` rewrite imports: `@enkaku/hd-keystore` → `@kokuin/deterministic`; `@enkaku/ledger-identity` → `@kokuin/ledger-device`; `@enkaku/token` → `@kokuin/token`. Delete the now-stale `tests/_ported/ledger/node_modules/@enkaku` symlink dir if present.

- [ ] **Step 4: Rewire the two parked MLS test files + add package.json**

In both `tests/_ported/integration-mls/*.test.ts`, rewrite imports: `@enkaku/group` → `@kumiai/mls`; `@enkaku/hub-client` → `@kumiai/hub-client`; `@enkaku/hub-protocol` → `@kumiai/hub-protocol`; `@enkaku/hub-server` → `@kumiai/hub-server`; `@enkaku/hub-tunnel` → `@kumiai/hub-tunnel`. Leave `@enkaku/client`, `@enkaku/protocol`, `@enkaku/transport`, `@enkaku/server`, `@kokuin/capability`, `@kokuin/token`, and `vitest` imports unchanged.

Create `tests/_ported/integration-mls/package.json`:
```json
{
  "name": "@kumiai/integration-mls-tests",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "@kumiai/mls": "^0.1.0",
    "@kumiai/hub-client": "^0.1.0",
    "@kumiai/hub-protocol": "^0.1.0",
    "@kumiai/hub-server": "^0.1.0",
    "@kumiai/hub-tunnel": "^0.1.0",
    "@enkaku/client": "^0.18.0",
    "@enkaku/protocol": "^0.18.0",
    "@enkaku/transport": "^0.18.0",
    "@enkaku/server": "^0.18.0",
    "@kokuin/capability": "^0.1.0",
    "@kokuin/token": "^0.1.0",
    "vitest": "^4.1.9"
  }
}
```
Create `tests/_ported/integration-mls/vitest.config.ts` (copy from `tests/integration/vitest.config.ts`).

- [ ] **Step 5: Strip MLS deps from `tests/integration/package.json`**

Remove these four from `dependencies`: `@enkaku/hub-client`, `@enkaku/hub-protocol`, `@enkaku/hub-server`, `@enkaku/hub-tunnel`. Remove from `devDependencies`: `@enkaku/group`. Leave all RPC deps, `@kokuin/capability`, `@kokuin/token`, `@sozai/event`, and the catalog deps intact.

- [ ] **Step 6: Write `tests/_ported/README.md`**

```markdown
# Ported tests (not part of this workspace)

These tests moved out of `tests/*` because the code they exercise left `@enkaku`.
They are kept verbatim (deps rewired to the new scopes) to be re-homed, then deleted here.

- `e2e-expo/`, `integration-mls/` → `@kumiai` (awaiting `@kumiai` publish)
- `ledger/` → `@kokuin` (owns the keystores + the BOLOS firmware)

This directory is nested below `tests/` so it falls outside the `tests/*`
workspace glob: not installed, not built, not run.
```

- [ ] **Step 7: Verify install + integration suite green**

```bash
pnpm install
pnpm run -C tests/integration test:unit
```
Expected: install resolves (no `@kumiai` in any installed package); integration RPC tests pass; `tests/_ported/**` absent from `pnpm install`'s project list.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: park @kumiai/@kokuin-bound tests out of the workspace"
```

---

### Task 2: Rewire surviving tests to published @kokuin

`tests/e2e-electron` and `tests/e2e-web` stay in the workspace but reference keystores that are about to be deleted. Point them at the published `@kokuin` equivalents (extracted from these exact packages — API-identical).

**Files:**
- Modify: `tests/e2e-electron/package.json`, `tests/e2e-electron/src/main.ts`
- Modify: `tests/e2e-web/package.json`, `tests/e2e-web/src/App.tsx`

- [ ] **Step 1: e2e-electron**

`tests/e2e-electron/package.json`: in `dependencies` replace `"@enkaku/electron-keystore": "workspace:*"` with `"@kokuin/electron": "^0.1.0"`. Leave `@enkaku/electron` (RPC), `@enkaku/client`, `@enkaku/server`, `@enkaku/transport`, `@kokuin/token`, and the `@enkaku/protocol` devDep unchanged.

`tests/e2e-electron/src/main.ts`: rewrite the `@enkaku/electron-keystore` import to `@kokuin/electron`. Leave the `@enkaku/electron` import (RPC transport) unchanged.

- [ ] **Step 2: e2e-web**

`tests/e2e-web/package.json`: replace `"@enkaku/browser-keystore": "workspace:*"` → `"@kokuin/browser": "^0.1.0"` and `"@enkaku/token": "workspace:*"` → `"@kokuin/token": "^0.1.0"`.

`tests/e2e-web/src/App.tsx`: `@enkaku/browser-keystore` → `@kokuin/browser`; `@enkaku/token` → `@kokuin/token`.

- [ ] **Step 3: Verify install + typecheck**

```bash
pnpm install
pnpm run -C tests/e2e-electron build || true   # vite/electron build if defined
pnpm run -r --filter ./tests/e2e-electron --filter ./tests/e2e-web test:types 2>/dev/null || pnpm run test
```
Expected: install resolves; both packages typecheck against `@kokuin/*`. If a package has no `test:types`, the workspace `pnpm run test` covering it must pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: rewire e2e-electron + e2e-web keystores to published @kokuin"
```

---

### Task 3: Delete the 29 dead packages and apps/ledger

After Tasks 1-2, the only workspace references to the doomed packages are among the doomed packages themselves. Delete them as a unit.

**Files:**
- Delete: the 29 `packages/<name>/` dirs (Global Constraints list)
- Delete: `apps/ledger/`

- [ ] **Step 1: Remove the directories**

```bash
git rm -r \
  packages/async packages/codec packages/event packages/execution packages/flow \
  packages/generator packages/log packages/otel packages/patch packages/result \
  packages/runtime packages/schema packages/stream packages/expo-runtime \
  packages/token packages/capability packages/browser-keystore packages/node-keystore \
  packages/electron-keystore packages/expo-keystore packages/hd-keystore packages/ledger-identity \
  packages/broadcast packages/group packages/group-rpc \
  packages/hub-client packages/hub-protocol packages/hub-server packages/hub-tunnel \
  apps/ledger
```

- [ ] **Step 2: Reinstall and confirm no dangling references**

```bash
pnpm install
# must print nothing: no surviving workspace package references a deleted one
grep -RIl --include=package.json -E '@enkaku/(async|codec|event|execution|flow|generator|log|otel|patch|result|runtime|schema|stream|expo-runtime|token|capability|browser-keystore|node-keystore|electron-keystore|expo-keystore|hd-keystore|ledger-identity|broadcast|group|group-rpc|hub-client|hub-protocol|hub-server|hub-tunnel)' packages tests/integration tests/e2e-electron tests/e2e-web 2>/dev/null || echo "CLEAN"
```
Expected: `pnpm install` resolves with no errors; grep prints `CLEAN`. (Use the repo's real grep; `rtk grep` aliases may differ — `git grep` is fine.)

- [ ] **Step 3: Full gate**

```bash
pnpm run build
pnpm run test
rtk proxy pnpm run lint
```
Expected: all exit 0. `apps/` is now empty or gone — confirm nothing references it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: delete packages moved to @sozai/@kokuin/@kumiai + apps/ledger"
```

---

### Task 4: Remove Phase-1 cruft (codemod, changeset ignore, dead catalog)

**Files:**
- Delete: `scripts/codemod-v018.mjs`
- Modify: `.changeset/config.json`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Delete the one-shot codemod**

```bash
git rm scripts/codemod-v018.mjs
```

- [ ] **Step 2: Empty the changeset ignore list**

`.changeset/config.json`: set `"ignore": []` (its seven entries are the now-deleted MLS packages).

- [ ] **Step 3: Prune dead catalog entries**

In `pnpm-workspace.yaml` under `catalog:`, remove these 29 keys (zero remaining consumers among kept packages, kept tests, `website`, root):
```
@logtape/logtape  @napi-rs/keyring  @noble/ciphers  @noble/curves  @noble/hashes
@opentelemetry/api  @opentelemetry/api-logs  @scure/base  @scure/bip39
@standard-schema/spec  @testing-library/jest-dom  @testing-library/react
ajv  ajv-formats  canonicalize  electron-store  eventsource-parser
expo  expo-crypto  expo-secure-store  expo-status-bar  happy-dom
json-schema-to-ts  micro-key-producer  playwright  react-native  ts-mls
uint8arrays  undici
```
Do NOT remove the toolchain pins even though unreferenced: `@biomejs/biome`, `@swc/core`, `@swc/cli`, `turbo`, `vitest`, `@vitest/ui`, `tsx`, `del-cli`, `@types/node`, `typescript`. Leave `minimumReleaseAgeExclude` and the `- website` workspace glob untouched.

- [ ] **Step 4: Verify install is the catalog check**

```bash
pnpm install
```
Expected: resolves clean. If pnpm errors that a removed catalog key is still referenced (`catalog:` with no matching entry), restore exactly that key and re-run.

- [ ] **Step 5: Final gate**

```bash
pnpm run build
pnpm run test
rtk proxy pnpm run lint
```
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: drop Phase-1 codemod, changeset ignore list, and dead catalog entries"
```

---

## Self-Review notes

- **Spec coverage:** §1 packages → Task 3; §2 apps/ledger → Task 3; §3 tests (keep/rewire/park) → Tasks 1-2; §4 config cruft → Task 4; §5 gate → every task + final. All covered.
- **Ordering:** reference-clearing (Tasks 1-2) strictly precedes deletion (Task 3); cruft (Task 4) last. No task leaves the workspace red.
- **Type/name consistency:** keystore scope renames (`electron-keystore`→`@kokuin/electron`, `browser-keystore`→`@kokuin/browser`, `hd-keystore`→`@kokuin/deterministic`, `ledger-identity`→`@kokuin/ledger-device`, `expo-keystore`→`@kokuin/expo`, `expo-runtime`→`@sozai/runtime-expo`, `group`→`@kumiai/mls`) match the repo-split codemod spec exactly.
- **`@enkaku/electron` vs `@kokuin/electron`:** both exist and are both imported in `e2e-electron/src/main.ts` — the former is the RPC transport (kept), the latter the keystore (rewired). Rewrite only the keystore import.
