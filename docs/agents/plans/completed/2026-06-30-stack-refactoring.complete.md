# Stack Refactoring (branch `chore/stack-refactoring`) — Completed

**Status:** complete
**Date:** 2026-06-30
**Commits:** `67b235f..ff80ed0` (25 commits)

Consolidates four sequenced workstreams that together retooled `enkaku` onto the
five-repo Yulsi split (`@kigu`/`@sozai`/`@kokuin`/`@kumiai`) and trimmed it to an
RPC-only repo. Parent design: `../../../../kigu/docs/repo-split-design.md`.

---

## 1. v0.18 migration — phase 1 (retool + rewire + rename)

**Goal:** Retool onto the new upstreams without deleting anything, publish RPC at 0.18.0.

**What was built:**
- Tooling retooled onto `@kigu/dev`: root `biome.json` extends `@kigu/dev/biome.json`;
  RPC/MLS packages point swc/tsconfig at `@kigu/dev`; changesets added; toolchain devDeps
  dropped (now transitive via `@kigu/dev`).
- RPC + MLS deps rewired: `@enkaku/{core}` → `@sozai/*`, `@enkaku/{token,capability}` →
  `@kokuin/*`, direct `^0.1.0` ranges (not catalog).
- RPC transports renamed: `http-client-transport`→`http-fetch`, `http-server-transport`→
  `http-serve`, `socket-transport`→`socket`, `node-streams-transport`→`node-streams`,
  `message-transport`→`message`, `electron-rpc`→`electron`.
- `KeyEntry`/`KeyStore` removed from `@enkaku/protocol`; consumers import from `@kokuin/token`
  directly (no back-compat re-export, by user direction).
- RPC packages bumped to **0.18.0**.

**Key decisions:** MLS rewired alongside RPC (not just published RPC) to avoid dual-identity
type clashes at the RPC↔MLS boundary. Nothing deleted in this phase — frozen packages stayed
republishable until downstream repos extracted them.

## 2. Phase 2 cleanup (deletions → RPC-only)

**Goal:** Trim `@enkaku` to RPC-only once `@kumiai` had extracted the MLS source; lift phase-1's
no-deletions constraint.

**What was built:**
- Deleted 29 package dirs: 14 core (→`@sozai`), 8 identity (→`@kokuin`), 7 MLS (→`@kumiai`).
  Kept exactly the 12 RPC packages.
- Deleted `apps/ledger` (BOLOS firmware, moved to `@kokuin`).
- Tests: kept + rewired `e2e-electron`/`e2e-web`/`integration` onto published `@kokuin`/`@sozai`;
  parked `@kumiai`-blocked tests (`e2e-expo`, integration MLS files) and `ledger` out of the
  workspace (since fully ported to their downstream owners).
- Cruft removed: one-shot `scripts/codemod-v018.mjs`, dead `.changeset` ignore entries,
  unreferenced catalog pins (toolchain pins retained).

**Key decisions:** Deletion was mechanically safe because phase-1's codemod had already rewired
all kept packages off the deleted ones. No back-compat re-export of relocated keystore types.
Downstream `mokei`/`kubun` migrate on their own PRs (still consume published 0.17.x).

## 3. OTel per-repo span namespacing

**Goal:** Stop `@enkaku`/`@kokuin` spans being mislabeled `sozai.*` after instrumentation moved
into shared `@sozai/otel`.

**What was built (enkaku side):**
- New `@enkaku/otel` package: `createTracer = createTracerFactory('enkaku')`, plus
  `EnkakuSpanNames` / `EnkakuAttributeKeys` (all `enkaku.*` prefixed).
- Rewired 5 consumers (`client server http-fetch http-serve socket`) to import `createTracer`
  + names from `@enkaku/otel`, keeping std `RPC_*`/`HTTP_*`/`NET_*` + `withSpan` infra from
  `@sozai/otel`.
- `tests/integration/otel.test.ts` updated to assert `enkaku.*` spans plus `kokuin.token.sign`
  (cross-package trace propagation).

**Key decisions:** Domain names live in the owning repo; `@sozai/otel` (bottom layer) defines
infra + std attrs only and emits no spans — avoids a layering violation where the base package
would reference upstream domains. Coordinated cross-repo change (sozai → kokuin → enkaku) via
published npm versions. (sozai/kokuin sides done in their own repos.)

## 4. CI: consume kigu reusable workflows

**Goal:** Replace enkaku's duplicated GitHub Actions with thin wrappers consuming
`TairuFramework/kigu` reusable workflows, mirroring kokuin.

**What was built:**
- `.github/workflows/` reduced to 3 wrappers (`build-test`, `e2e-web`, `e2e-desktop`), each
  `uses: TairuFramework/kigu/.github/workflows/<name>.yml@main`. Triggers: push on `main` +
  pull_request.
- Deleted cruft `e2e-android.yml`/`e2e-ios.yml` (pointed at nonexistent `tests/e2e-expo`) and
  the local `.github/actions/setup-environment` composite action (kigu's `setup` action
  replaces it).

**Key decisions:** Pin at `@main` (match kokuin). Deno CI skipped — kigu has no deno reusable
workflow. Supersedes the phase-1 design's "CI: no change" note.

## 5. Deno tests update

Refreshed `tests/deno` (stateful client/server/protocol, `package.json`, lockfile). Standalone
RPC-only, no workspace deps; still outside CI.

---

## Final state

`packages/` = 12 RPC packages + `@enkaku/otel`, all at 0.18.x. Zero in-repo references to
deleted core/identity/MLS packages. Deps sourced from published `@sozai`/`@kokuin`. CI runs via
kigu reusable workflows.

## Deferred (not this branch)

- `website/`/`docs/` typedoc regeneration (stale `api/<deleted-pkg>/` dirs).
- Porting parked tests to `@kumiai`/`@kokuin` once those publish the relevant packages.
- Downstream `mokei`/`kubun` codemod to `@sozai`/`@kokuin`.
- Publishing (`pnpm run release`) — manual, post-merge.
- Deno CI (no kigu deno workflow yet).
