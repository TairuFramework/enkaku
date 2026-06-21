# Enkaku v0.18 migration — phase 1 (retool + rewire, no deletions)

Status: approved design (brainstorm complete, 2026-06-21)
Scope: retool the `enkaku` repo onto the new `@kigu`/`@sozai`/`@kokuin` upstreams, rewire and
rename the RPC packages, publish RPC at 0.18.0. No package deletions in this phase.

Parent design: `../../../kigu/docs/repo-split-design.md` (the full five-repo split). This document
covers only the enkaku-side phase-1 slice of that plan.

## Context

Upstream repos are already published: `@kigu/dev@0.1.0` (toolchain preset), `@sozai/*@0.1.0`
(core utilities + library wrappers), `@kokuin/*@0.1.0` (identity / keys). Enkaku is at 0.17.x.

Downstream `kumiai` (MLS) does not exist yet as packages — it will later extract the MLS source
from this repo. Downstream `kubun` / `mokei` still import `@enkaku/*` core/identity from npm and
migrate later. Therefore **this phase deletes nothing**: frozen packages stay in the tree so they
remain republishable for back-compat, and the MLS packages stay until kumiai extracts them.

### Phasing

- **P1 (this work):** retool to `@kigu/dev`; rewire RPC + MLS onto `@sozai`/`@kokuin`; rename RPC
  transports; relocate keystore types out of `@enkaku/protocol`; publish RPC at **0.18.0**.
- **P2 (later, kumiai repo):** kumiai extracts the MLS package source.
- **P3 (later, enkaku cleanup):** delete the frozen core/identity packages and the
  kumiai-extracted MLS packages; finalize.

## Package taxonomy (this repo, post-P1)

| group | packages | P1 treatment |
|-------|----------|--------------|
| **RPC — kept** | protocol, transport, client, server, standalone, http-fetch, http-serve, socket, node-streams, message, electron, react | retooled, rewired, renamed, bumped **0.18.0**, published |
| **MLS — kept-until-P2** | group, broadcast, hub-protocol, hub-client, hub-server, hub-tunnel, group-rpc | retooled, rewired to stay green, version unchanged, **not published** |
| **core — frozen** | async, codec, event, execution, flow, generator, log, otel, patch, result, runtime, schema, stream, expo-runtime | untouched, stay at 0.17, excluded from changeset |
| **identity — frozen** | token, capability, browser-keystore, node-keystore, electron-keystore, expo-keystore, hd-keystore, ledger-identity | untouched except keystore importers (see §4), stay at 0.17 |

After P1 nothing in-repo imports the frozen core/identity packages — they are dead-but-buildable,
retained only for back-compat republish until consumers migrate.

## 1. Tooling retool

- **Root `package.json`:** add `@kigu/dev` and `@changesets/cli` devDeps; add `changeset` /
  `version` / `release` scripts mirroring sozai. Remove toolchain devDeps now supplied transitively
  by `@kigu/dev` (`@biomejs/biome`, `@swc/cli`, `@swc/core`, `@types/node`, `@vitest/ui`,
  `del-cli`, `tsx`, `turbo`, `typescript`, `vitest`). Keep docs/website-only devDeps (typedoc etc.)
  as needed.
- **Root `biome.json`:** replace body with `extends: ["@kigu/dev/biome.json"]` + the local `vcs`
  block (sozai pattern).
- **Keep** root `swc.json` and `tsconfig.build.json` — the frozen packages still build against them
  via their existing `../../swc.json` / `../../tsconfig.build.json` references.
- **RPC + MLS packages only:** point `build:js` `--config-file` at `@kigu/dev/swc.json`; switch each
  package `tsconfig.json` to `extends: "@kigu/dev/tsconfig.json"`. Frozen packages keep their
  current config references untouched.
- **Changesets:** add `.changeset/` config matching sozai/kokuin. Release stays manual
  (`pnpm run release` → `changeset publish`).
- **CI:** no change. `.github/actions/setup-environment` runs `pnpm install` + `pnpm run build`;
  renames and rewires are transparent to it. pnpm version stays pinned via `packageManager`.

## 2. Dependency rewire (RPC + MLS)

For every RPC and MLS package, edit both `package.json` dependencies and `src/**` import statements:

- core dep `@enkaku/{async,codec,event,execution,flow,generator,log,otel,patch,result,runtime,schema,stream}`
  → `@sozai/<same>` at `^0.1.0`
- identity dep `@enkaku/{token,capability}` → `@kokuin/<same>` at `^0.1.0`
- internal RPC/MLS deps (`@enkaku/{protocol,transport,client,server,standalone,broadcast,hub-*}`)
  stay `@enkaku/*`, retargeted to renamed names where §3 applies
- ranges are direct `^0.1.0` (kokuin convention), not catalog entries

Rewiring MLS as well as RPC keeps every in-repo type sourced from a single external core, avoiding
dual-identity type clashes at the RPC↔MLS boundary (e.g. `broadcast` mixing local `@enkaku/async`
with a rewired `@enkaku/transport`). This is why MLS is rewired now even though it is not published.

Per-package core/identity dep rewrites (internal RPC/MLS deps omitted):

| package | → `@sozai` | → `@kokuin` |
|---------|-----------|-------------|
| protocol | — | token |
| transport | async, event, stream | — |
| client | async, event, execution, log, runtime, otel, stream | token |
| server | async, event, log, otel, runtime, schema, stream | capability, token |
| http-fetch | otel, runtime, stream | — |
| http-serve | async, otel, runtime, stream | — |
| socket | otel, stream | — |
| node-streams | stream | — |
| group | runtime | capability, token |
| broadcast | async, codec | — |
| hub-protocol | event | — |
| hub-server | codec, event, stream | token |
| hub-tunnel | async, codec, schema | — |
| group-rpc | codec | — |

(`standalone`, `message`, `electron`, `react`, `hub-client` have only internal `@enkaku/*` deps —
no core/identity rewire.)

## 3. RPC transport renames

Rename directory, `name` field, and all import sites (packages, `tests/**`, `website/docs/**`):

| from | to |
|------|-----|
| http-client-transport | http-fetch |
| http-server-transport | http-serve |
| socket-transport | socket |
| node-streams-transport | node-streams |
| message-transport | message |
| electron-rpc | electron |

`protocol` / `transport` / `client` / `server` / `standalone` / `react` keep their names. No MLS
package imports a renamed transport (they touch only `@enkaku/transport` / `protocol` / `client` /
`server`), so the rename is self-contained to RPC + tests + docs. Old names remain published at
0.17 on npm and are simply never republished.

## 4. Keystore types relocation

`KeyEntry` / `KeyStore` currently live in `@enkaku/protocol` (`src/types/keystore.ts`) and are
re-exported from its index. `@kokuin/token@0.1.0` already ships the identical types (its canonical
home). In P1:

- Delete `packages/protocol/src/types/keystore.ts` and remove the index re-export. No re-export of
  these types from protocol — consumers import from the source package directly.
- The only in-repo importers are the frozen keystore packages (`node`, `browser`, `electron`,
  `expo`, `hd`-keystore), which import `KeyStore` / `KeyEntry` from `@enkaku/protocol`. Repoint each
  to `@kokuin/token` (one import line each) and add a `@kokuin/token` dep. This is the single
  necessary edit to otherwise-frozen packages.

## 5. Versioning & publish

- RPC packages → **0.18.0**, published via changesets. The minor bump signals the breaking reorg
  (renamed transports, deps rewired to `@sozai`/`@kokuin`, keystore types relocated).
- MLS packages → rewired to keep the workspace green, version unchanged, **not published** —
  kumiai extracts the source in P2 and ships it as `@kumiai/*@0.1.0`. Consumers still on
  `@enkaku/group@0.17` etc. from npm are unaffected.
- Frozen core/identity packages → stay at 0.17, untouched (except §4 keystore importers), excluded
  from the 0.18 changeset.

## 6. In-repo consumers

Update import sites for renames + new scopes across `tests/{deno,integration,e2e-electron,e2e-web,e2e-expo}`
and `website/docs/**`. Leave `apps/ledger` and `tests/ledger` frozen (already mirrored in kokuin).

## 7. Verification

- `pnpm install` resolves (published `@kigu`/`@sozai`/`@kokuin` ranges).
- `pnpm run build` green across the whole workspace, including frozen core/identity.
- `pnpm run test` (turbo `test:types` + `test:unit`) green; integration/e2e tests reference renamed
  transports correctly.
- `rtk proxy pnpm run lint` clean.
- Spot-check: no kept RPC/MLS package still imports a `@enkaku/*` core or identity package; no
  package imports `KeyStore` / `KeyEntry` from `@enkaku/protocol`.

## Out of scope (later phases)

- Deleting frozen core/identity packages (P3).
- Deleting / extracting MLS packages (P2 in kumiai, P3 deletion here).
- Renaming MLS packages (`group`→`mls`, `group-rpc`→`rpc`) — happens in kumiai.
- Migrating `kubun` / `mokei` consumers.
