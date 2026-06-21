# Enkaku Phase 2 Cleanup — Design

Status: approved design (2026-06-21)
Predecessor: `2026-06-21-enkaku-v018-migration-design.md` (Phase 1 — retool onto `@kigu/dev`, rewire RPC+MLS deps onto `@sozai`/`@kokuin`, rename transports, bump RPC to 0.18.0). Phase 1 landed on `chore/stack-refactoring` (commits `faa1bb9..6fc4cb0`), unmerged to `main`.

## Goal

Trim `@enkaku` to RPC-only, matching the final shape in `kigu/docs/repo-split-design.md` §107-127. Delete every package, app, and test that moved to `@sozai` (core), `@kokuin` (identity), or `@kumiai` (MLS). The downstream `@kumiai` repo has already extracted the MLS packages (`broadcast`, `hub-*`, `mls`=group, `rpc`=group-rpc), so the no-deletions constraint from Phase 1 is lifted.

## Context (verified state)

- **Branch:** continue on `chore/stack-refactoring` — Phase 1 + cleanup merge to `main` as one unit.
- **Scope:** code-only. Website/docs typedoc regeneration is deferred to a later pass.
- **Kept packages are clean:** the 12 RPC packages reference (in `package.json` deps and `src/`) **zero** deleted packages — Phase 1's codemod already rewired them onto `@sozai`/`@kokuin`. Deletion is mechanically safe.
- **Build/test gate excludes website:** `website` has only `typecheck`/`docusaurus build` scripts, not `build:types`/`build:js`/`test:types`/`test:unit`, so it is absent from `pnpm run build` (`pnpm -r build:types` + `turbo build:js`) and `pnpm run test` (`turbo test:types test:unit`). `website/package.json` has no `@enkaku/*` deps, so deletions do not break `pnpm install` or the gate. Leaving `website/` stale is safe.
- **Downstream repos out of scope:** `mokei` and `kubun` are separate workspaces consuming *published* `@enkaku` 0.17.x packages. Deleting source does not unpublish npm; they migrate to `@sozai`/`@kokuin` on their own PRs (repo-split-design §259, step 6).

## 1. Package deletions

Delete these 29 package directories under `packages/`:

**Core → @sozai (14):** `async`, `codec`, `event`, `execution`, `flow`, `generator`, `log`, `otel`, `patch`, `result`, `runtime`, `schema`, `stream`, `expo-runtime`

**Identity → @kokuin (8):** `token`, `capability`, `browser-keystore`, `node-keystore`, `electron-keystore`, `expo-keystore`, `hd-keystore`, `ledger-identity`

**MLS → @kumiai (7):** `broadcast`, `group`, `group-rpc`, `hub-client`, `hub-protocol`, `hub-server`, `hub-tunnel`

Keep exactly these 12 (RPC): `protocol`, `transport`, `client`, `server`, `standalone`, `http-fetch`, `http-serve`, `socket`, `node-streams`, `message`, `electron`, `react`.

**No back-compat re-export.** repo-split-design §96-98 floats re-exporting `KeyEntry`/`KeyStore` from `@kokuin/token` for back-compat; Phase 1 removed those types from `@enkaku/protocol` entirely (per user direction "import from source package directly"). Do not reintroduce a re-export.

## 2. apps/

Delete `apps/ledger` — the BOLOS on-device firmware (C, Ledger Nano S+/X). It pairs with `@kokuin/ledger-device` and moved to `@kokuin`'s `apps/ledger` (repo-split-design §100-105). It is outside the `packages/*` glob (own Docker/Makefile), so deletion does not affect pnpm.

## 3. tests/

| dir | action | reason |
|-----|--------|--------|
| `tests/e2e-expo` | **delete** | deps `expo-keystore`, `expo-runtime`, `group`, `token` — all moved; nothing RPC remains |
| `tests/e2e-web` | **delete** | deps `browser-keystore`, `token` — both moved to `@kokuin`; pure keystore test |
No test directory is deleted. The intent is to **keep and rewire every test** so it can later be ported to the repo that now owns the code under test. A test stays in place (in the install/test gate) when it still exercises kept `@enkaku` RPC code *and* its other deps are published. A test is parked out of the workspace when it no longer belongs here — blocked on the unpublished `@kumiai`, or purely testing moved code whose runtime (e.g. the BOLOS firmware) is gone (see "Parking").

| dir | action | reason |
|-----|--------|--------|
| `tests/e2e-electron` | **keep + rewire** | exercises kept `@enkaku/electron` RPC; rewire `@enkaku/electron-keystore` → `@kokuin/electron` (`^0.1.0`) and the matching `src` import |
| `tests/e2e-web` | **keep + rewire** | rewire `@enkaku/browser-keystore` → `@kokuin/browser`, `@enkaku/token` → `@kokuin/token` (both published) in `package.json` + `src` |
| `tests/integration` | **keep + rewire + park MLS** | RPC files already rewired (Phase 1); park the 2 MLS files (below) and strip MLS deps from `package.json` |
| `tests/e2e-expo` | **park** | depends on `@enkaku/group` → `@kumiai/mls` (unpublished); cannot install in the workspace; bound for `@kumiai` |
| `tests/ledger` | **park** | tests moved `@kokuin` keystores + needs the BOLOS firmware (deleted `apps/ledger`, now at `@kokuin`); to be taken over by `@kokuin`. Rewire to `@kokuin/deterministic`, `@kokuin/ledger-device`, `@kokuin/token` |
| `tests/deno` | **leave** | no workspace deps (esm.sh URLs, version-pinned to old published); RPC-only; revive on publish. Flagged, not modified. |

**`tests/integration` (`@enkaku/integration-tests`):**
- Park `hub-agent-scenarios.test.ts` and `hub-tunnel-echo.test.ts` (the only two files importing `@enkaku/group` / `@enkaku/hub-*`) — see Parking.
- From `tests/integration/package.json` remove the `@kumiai`-bound deps: `@enkaku/group`, `@enkaku/hub-client`, `@enkaku/hub-protocol`, `@enkaku/hub-server`, `@enkaku/hub-tunnel`.
- Keep the RPC test files in place: `access-control-predicate`, `client-lifecycle`, `client-server`, `close-settles`, `http-transport`, `node-streams-transport`, `otel`, `server-teardown-no-unhandled`, `teardown`, `transport-failure-no-unhandled`, and `node-streams-server.js`.

**Parking (`@kumiai`-blocked tests):**
- Create `tests/_ported/` — nested two levels below `tests/`, so it falls *outside* the single-level `tests/*` workspace glob and is excluded from `pnpm install` and the gate. (Verified: pnpm `tests/*` matches direct children only.)
- Move `tests/e2e-expo` → `tests/_ported/e2e-expo`; rewire its `package.json` + `src` to the new scopes: `expo-keystore` → `@kokuin/expo`, `expo-runtime` → `@sozai/runtime-expo`, `token` → `@kokuin/token`, `group` → `@kumiai/mls`.
- Move the two integration MLS files → `tests/_ported/integration-mls/` with a minimal `package.json` listing their rewired deps (`@kumiai/mls`, `@kumiai/hub-client`, `@kumiai/hub-protocol`, `@kumiai/hub-server`, `@kumiai/hub-tunnel`, and the kept `@enkaku/*` RPC deps they use); rewire the `@enkaku/group` / `@enkaku/hub-*` imports in both files to `@kumiai/*`.
- Move `tests/ledger` → `tests/_ported/ledger`; rewire its `package.json` + `src` to `@kokuin/deterministic`, `@kokuin/ledger-device`, `@kokuin/token`. Bound for `@kokuin` (it owns the firmware + keystores).
- Add `tests/_ported/README.md`: these are destined for `@kumiai` (`e2e-expo`, `integration-mls`) and `@kokuin` (`ledger`); not installed or run here.

## 4. Config / cruft

- **`scripts/codemod-v018.mjs`** — delete (one-shot Phase 1 migration tool, spent).
- **`.changeset/config.json`** — empty the `ignore` array (its 7 entries are the now-deleted MLS packages; a changeset `ignore` entry naming a nonexistent package is dead config).
- **`pnpm-workspace.yaml` `catalog:`** — remove entries with zero remaining consumers among kept packages, kept tests, `website`, and root `package.json`. **Exclude toolchain pins even if currently unreferenced:** `@biomejs/biome`, `@swc/core`, `@swc/cli`, `turbo`, `vitest`, `@vitest/ui`, `tsx`, `del-cli`, `@types/node`, `typescript` (central version pins). The exact removable set is computed in the plan; `pnpm install` success is the verification — if install demands a removed key, restore it. Leave `minimumReleaseAgeExclude` (its `@sozai`/`@kokuin` entries are still consumed) and the `- website` workspace glob.

## 5. Verification

Each task ends green. Final gate, all exit 0:

```
pnpm install        # no dangling workspace:^ to deleted packages
pnpm run build      # build:types (pnpm -r) + build:js (turbo)
pnpm run test       # turbo test:types test:unit
rtk proxy pnpm run lint
```

## Deferred (explicitly not this branch)

- `website/` + `docs/` typedoc API regeneration (stale `api/<deleted-pkg>/` dirs and references remain until a docs pass before publish).
- `tests/deno` esm.sh version refresh + `deno.lock` (pinned to old published versions).
- Porting parked + rewired tests to their new owners: `tests/_ported/e2e-expo` + `tests/_ported/integration-mls` → `@kumiai` (once it publishes); `tests/_ported/ledger` → `@kokuin`; `tests/e2e-web` (and the `@kokuin`-keystore parts of `tests/e2e-electron`) → `@kokuin`. Kept/rewired here only so the source survives the trim.
- Downstream `mokei` / `kubun` codemod to `@sozai`/`@kokuin` (separate repos, separate PRs).
- Publishing (`pnpm run release`) — manual, post-review.
