# Enkaku v0.18 Migration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retool the `enkaku` repo onto `@kigu/dev`, rewire the RPC and MLS packages onto published `@sozai`/`@kokuin`, rename the RPC transports, relocate keystore types out of `@enkaku/protocol`, and publish the RPC layer at 0.18.0 — deleting nothing.

**Architecture:** Mechanical refactor. Frozen core/identity packages stay in the tree (still building against retained root `swc.json`/`tsconfig.build.json`), so the workspace stays green after every task. A reusable codemod rewrites dependency specifiers and import statements; renames are applied repo-wide and atomically (package dir + name field + all importers) so each commit leaves `pnpm run build` and `pnpm run test` passing.

**Tech Stack:** pnpm workspaces, turbo, swc, tsc, biome, changesets, vitest.

## Global Constraints

- **Package manager:** pnpm only. Never `npm`/`npx`. Lint via `rtk proxy pnpm run lint` (not bare `pnpm run lint`).
- **No deletions of packages.** Frozen core/identity (async…stream, expo-runtime, token, capability, *-keystore, ledger-identity) and MLS (group, broadcast, hub-*, group-rpc) packages stay in the tree.
- **Cross-repo dep ranges:** `@sozai/*` and `@kokuin/*` at `^0.1.0` (direct range, not catalog, not `workspace:`).
- **Internal RPC/MLS deps stay `workspace:^`** and keep the `@enkaku/*` scope.
- **Core set (→ `@sozai`):** async, codec, event, execution, flow, generator, log, otel, patch, result, runtime, schema, stream.
- **Identity set (→ `@kokuin`):** token, capability.
- **RPC packages publish at 0.18.0.** MLS packages are rewired but **not** version-bumped and **not** published. Frozen core/identity stay at 0.17.
- **Naming guardrails:** `type` not `interface`; `Array<T>` not `T[]`; no `any`; `HTTP`/`ID`/`JWT` casing. (Refactor touches imports/configs only — unlikely to hit these, but hold the line.)
- **Verification is the test.** This is a refactor with no new behavior; each task's "test" is a green `pnpm run build` / `pnpm run test` / lint, plus targeted greps proving the edit landed.

---

### Task 1: Repo tooling retool

Switch the repo onto `@kigu/dev` + changesets, matching sozai/kokuin. Keep root `swc.json` and `tsconfig.build.json` so frozen packages keep building unchanged.

**Files:**
- Modify: `package.json` (root)
- Modify: `biome.json` (root)
- Create: `.changeset/config.json`
- Keep (do NOT edit): `swc.json`, `tsconfig.build.json`, `tsconfig.json`, `pnpm-workspace.yaml`

**Interfaces:**
- Produces: `@kigu/dev` available at repo root (hoisted `node_modules`) so package configs in later tasks can `extends`/`--config-file` it; `changeset` script available for Task 6.

- [ ] **Step 1: Rewrite root `package.json`**

Replace the whole file with:

```json
{
  "name": "enkaku-repo",
  "version": "0.0.0",
  "author": "Paul Le Cam",
  "type": "module",
  "private": true,
  "packageManager": "pnpm@11.8.0",
  "scripts": {
    "prepare": "git config core.hooksPath .githooks",
    "lint": "biome check --write ./packages ./tests",
    "format": "biome format --write .",
    "test": "turbo run test:types test:unit",
    "build:js": "turbo run build:js",
    "build:types": "pnpm run -r build:types",
    "build": "pnpm run build:types && pnpm run build:js",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "pnpm run build && changeset publish"
  },
  "devDependencies": {
    "@kigu/dev": "^0.1.0",
    "@changesets/cli": "^2.27.0",
    "typedoc": "catalog:",
    "typedoc-plugin-markdown": "catalog:"
  }
}
```

(Removed the 10 toolchain devDeps now supplied transitively by `@kigu/dev`: `@biomejs/biome`, `@swc/cli`, `@swc/core`, `@types/node`, `@vitest/ui`, `del-cli`, `tsx`, `turbo`, `typescript`, `vitest`. Kept `typedoc`/`typedoc-plugin-markdown` — not in the preset.)

- [ ] **Step 2: Rewrite root `biome.json`** to extend the preset (sozai pattern)

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["@kigu/dev/biome.json"],
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }
}
```

- [ ] **Step 3: Create `.changeset/config.json`** (copied from sozai, baseBranch main)

```json
{
  "$schema": "../node_modules/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 4: Reinstall** to apply the toolchain swap

Run: `pnpm install`
Expected: resolves cleanly; `node_modules/@kigu/dev` present; no lockfile errors.

- [ ] **Step 5: Verify build + lint still green** (frozen packages build via retained root configs)

Run: `pnpm run build && rtk proxy pnpm run lint`
Expected: build completes for all 48 workspace projects; lint reports no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json biome.json .changeset pnpm-lock.yaml
git commit -m "chore: retool repo onto @kigu/dev + changesets"
```

---

### Task 2: Relocate keystore types out of `@enkaku/protocol`

`KeyEntry`/`KeyStore` move to their canonical home `@kokuin/token` (already published with them). Protocol drops the types entirely (no re-export); the only in-repo importers — the frozen keystore packages — repoint to `@kokuin/token`.

**Files:**
- Delete: `packages/protocol/src/types/keystore.ts`
- Modify: `packages/protocol/src/index.ts` (remove the keystore re-export line)
- Modify: `packages/{node,browser,electron,expo,hd}-keystore/src/store.ts`, `.../src/entry.ts` and any sibling importing `KeyStore`/`KeyEntry` from `@enkaku/protocol`
- Modify: `packages/{node,browser,electron,expo,hd}-keystore/package.json` (add `@kokuin/token` dep)

**Interfaces:**
- Produces: `@enkaku/protocol` no longer exports `KeyStore`/`KeyEntry`. Consumers of those types import from `@kokuin/token`.

- [ ] **Step 1: Delete the protocol keystore source**

```bash
git rm packages/protocol/src/types/keystore.ts
```

- [ ] **Step 2: Remove the re-export from `packages/protocol/src/index.ts`**

Delete this line:

```ts
export type * from './types/keystore.js'
```

- [ ] **Step 3: Repoint the frozen keystores' type imports** `@enkaku/protocol` → `@kokuin/token`

For each keystore package, rewrite the type-only imports. Mechanical replace across the five keystore `src` dirs:

```bash
cd /Users/paul/dev/yulsi/enkaku
for d in node-keystore browser-keystore electron-keystore expo-keystore hd-keystore; do
  grep -rl "from '@enkaku/protocol'" packages/$d/src | while read f; do
    # only the KeyStore/KeyEntry type imports come from protocol in these files
    sed -i '' "s#from '@enkaku/protocol'#from '@kokuin/token'#g" "$f"
  done
done
```

Then verify no keystore `src` file still imports from `@enkaku/protocol`:

Run: `grep -rn "@enkaku/protocol" packages/{node,browser,electron,expo,hd}-keystore/src`
Expected: no matches.

- [ ] **Step 4: Add `@kokuin/token` dependency** to each of the five keystore `package.json` files

Add to `dependencies` (keep existing `@enkaku/token` workspace dep — local copy still present):

```json
"@kokuin/token": "^0.1.0"
```

- [ ] **Step 5: Reinstall** so the new dep links

Run: `pnpm install`
Expected: clean resolve.

- [ ] **Step 6: Verify type build green**

Run: `pnpm run build:types`
Expected: all packages emit declarations with no errors — in particular `protocol` and the five keystores.

- [ ] **Step 7: Commit**

```bash
git add packages/protocol packages/node-keystore packages/browser-keystore packages/electron-keystore packages/expo-keystore packages/hd-keystore pnpm-lock.yaml
git commit -m "refactor: move KeyEntry/KeyStore types to @kokuin/token"
```

---

### Task 3: Rewire RPC + MLS deps onto `@sozai`/`@kokuin` and retool their configs

Codemod the 12 RPC and 7 MLS packages: rewrite `@enkaku/<core>` → `@sozai/<core>` and `@enkaku/<identity>` → `@kokuin/<identity>` in `package.json` deps/devDeps (set `^0.1.0`) and in `src` imports; leave internal `@enkaku/*` RPC/MLS deps as `workspace:^`. Then point each package's build config at `@kigu/dev`. Transports keep their old directory names here — renames happen in Task 4.

**Files:**
- Create: `scripts/codemod-v018.mjs`
- Modify: `packages/{protocol,transport,client,server,standalone,http-client-transport,http-server-transport,socket-transport,node-streams-transport,message-transport,electron-rpc,react}/{package.json,tsconfig.json,src/**}`
- Modify: `packages/{group,broadcast,hub-protocol,hub-client,hub-server,hub-tunnel,group-rpc}/{package.json,tsconfig.json,src/**}`

**Interfaces:**
- Consumes: `@kigu/dev` (Task 1), `@kokuin/token` exports (Task 2 path; protocol's `@enkaku/token` import becomes `@kokuin/token` here).
- Produces: RPC/MLS packages depend only on `@sozai`/`@kokuin` for core/identity and on `@enkaku/*` for internal RPC/MLS deps; no RPC/MLS `src` file imports an `@enkaku` core/identity package.

- [ ] **Step 1: Create the codemod** `scripts/codemod-v018.mjs`

```js
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CORE = new Set([
  'async', 'codec', 'event', 'execution', 'flow', 'generator',
  'log', 'otel', 'patch', 'result', 'runtime', 'schema', 'stream',
])
const IDENTITY = new Set(['token', 'capability'])

function newScope(name) {
  const m = name.match(/^@enkaku\/([a-z-]+)$/)
  if (!m) return null
  if (CORE.has(m[1])) return `@sozai/${m[1]}`
  if (IDENTITY.has(m[1])) return `@kokuin/${m[1]}`
  return null
}

function rewriteDeps(deps) {
  if (!deps) return deps
  const out = {}
  for (const [k, v] of Object.entries(deps)) {
    const t = newScope(k)
    if (t) out[t] = '^0.1.0'
    else out[k] = v
  }
  return out
}

function rewriteSrc(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (e !== 'lib' && e !== 'node_modules') rewriteSrc(p)
    } else if (/\.(ts|tsx)$/.test(e)) {
      const src = readFileSync(p, 'utf8')
      const next = src.replace(/@enkaku\/([a-z-]+)/g, (full, name) => {
        if (CORE.has(name)) return `@sozai/${name}`
        if (IDENTITY.has(name)) return `@kokuin/${name}`
        return full
      })
      if (next !== src) writeFileSync(p, next)
    }
  }
}

const pkgDir = process.argv[2]
const pjPath = join(pkgDir, 'package.json')
const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
pj.dependencies = rewriteDeps(pj.dependencies)
pj.devDependencies = rewriteDeps(pj.devDependencies)
writeFileSync(pjPath, `${JSON.stringify(pj, null, 2)}\n`)
rewriteSrc(join(pkgDir, 'src'))
console.log(`codemod: ${pkgDir}`)
```

- [ ] **Step 2: Run the codemod over all RPC + MLS packages**

```bash
cd /Users/paul/dev/yulsi/enkaku
for d in protocol transport client server standalone \
         http-client-transport http-server-transport socket-transport \
         node-streams-transport message-transport electron-rpc react \
         group broadcast hub-protocol hub-client hub-server hub-tunnel group-rpc; do
  node scripts/codemod-v018.mjs packages/$d
done
```

- [ ] **Step 3: Retool each package's build config** to `@kigu/dev`

```bash
cd /Users/paul/dev/yulsi/enkaku
for d in protocol transport client server standalone \
         http-client-transport http-server-transport socket-transport \
         node-streams-transport message-transport electron-rpc react \
         group broadcast hub-protocol hub-client hub-server hub-tunnel group-rpc; do
  sed -i '' 's#--config-file ../../swc.json#--config-file ../../node_modules/@kigu/dev/swc.json#' packages/$d/package.json
  sed -i '' 's#"extends": "../../tsconfig.build.json"#"extends": "@kigu/dev/tsconfig.json"#' packages/$d/tsconfig.json
done
```

- [ ] **Step 4: Verify the rewire** — no RPC/MLS package imports an `@enkaku` core/identity package

Run:
```bash
grep -rn "@enkaku/\(async\|codec\|event\|execution\|flow\|generator\|log\|otel\|patch\|result\|runtime\|schema\|stream\|token\|capability\)" \
  packages/{protocol,transport,client,server,standalone,http-client-transport,http-server-transport,socket-transport,node-streams-transport,message-transport,electron-rpc,react,group,broadcast,hub-protocol,hub-client,hub-server,hub-tunnel,group-rpc}/{src,package.json} 2>/dev/null
```
Expected: no matches.

- [ ] **Step 5: Reinstall + lint-format** (normalizes codemod-written JSON)

Run: `pnpm install && rtk proxy pnpm run lint`
Expected: clean resolve; lint applies formatting, reports no errors.

- [ ] **Step 6: Verify full build + test green**

Run: `pnpm run build && pnpm run test`
Expected: all packages build; `test:types` + `test:unit` pass across the workspace (RPC, MLS, and frozen packages).

- [ ] **Step 7: Commit**

```bash
git add scripts packages pnpm-lock.yaml
git commit -m "refactor: rewire RPC + MLS deps onto @sozai/@kokuin, retool configs"
```

---

### Task 4: Rename the RPC transports

Rename five transport packages repo-wide: directory, `name` field, and every importer (packages, tests, website docs). Atomic per the whole task so the build stays green.

Rename map:
- `http-client-transport` → `http-fetch`
- `http-server-transport` → `http-serve`
- `socket-transport` → `socket`
- `node-streams-transport` → `node-streams`
- `message-transport` → `message`

**Files:**
- Rename: `packages/<old>/` → `packages/<new>/` (5)
- Modify: each renamed `package.json` `name` field
- Modify: all importers across `packages/**`, `tests/**`, `website/docs/**`

**Interfaces:**
- Consumes: rewired packages from Task 3.
- Produces: transports published as `@enkaku/{http-fetch,http-serve,socket,node-streams,message}`.

- [ ] **Step 1: Move the directories**

```bash
cd /Users/paul/dev/yulsi/enkaku
git mv packages/http-client-transport packages/http-fetch
git mv packages/http-server-transport packages/http-serve
git mv packages/socket-transport packages/socket
git mv packages/node-streams-transport packages/node-streams
git mv packages/message-transport packages/message
```

- [ ] **Step 2: Rewrite every `@enkaku/<old>` specifier** across source, tests, docs, and the `name` fields

```bash
cd /Users/paul/dev/yulsi/enkaku
FILES=$(grep -rl "@enkaku/\(http-client-transport\|http-server-transport\|socket-transport\|node-streams-transport\|message-transport\)" \
  packages tests website --include='*.ts' --include='*.tsx' --include='*.js' \
  --include='*.json' --include='*.md' --include='*.mdx' 2>/dev/null | grep -v '/lib/')
for f in $FILES; do
  sed -i '' \
    -e 's#@enkaku/http-client-transport#@enkaku/http-fetch#g' \
    -e 's#@enkaku/http-server-transport#@enkaku/http-serve#g' \
    -e 's#@enkaku/socket-transport#@enkaku/socket#g' \
    -e 's#@enkaku/node-streams-transport#@enkaku/node-streams#g' \
    -e 's#@enkaku/message-transport#@enkaku/message#g' \
    "$f"
done
```

- [ ] **Step 3: Verify no stale references remain** (outside built `lib/`)

Run:
```bash
grep -rn "@enkaku/\(http-client-transport\|http-server-transport\|socket-transport\|node-streams-transport\|message-transport\)" \
  packages tests website 2>/dev/null | grep -v '/lib/'
```
Expected: no matches.

- [ ] **Step 4: Reinstall** to relink the renamed workspace packages

Run: `pnpm install`
Expected: clean resolve; workspace lists `@enkaku/http-fetch`, `@enkaku/http-serve`, `@enkaku/socket`, `@enkaku/node-streams`, `@enkaku/message`.

- [ ] **Step 5: Verify full build + test green**

Run: `pnpm run build && pnpm run test`
Expected: all green, including `tests/integration` and e2e packages that reference the transports.

- [ ] **Step 6: Commit**

```bash
git add packages tests website pnpm-lock.yaml
git commit -m "refactor: rename RPC transports (http-fetch/http-serve/socket/node-streams/message)"
```

---

### Task 5: Rename `electron-rpc` → `electron`

Same atomic-rename pattern for the platform-integration package. `react` keeps its name.

**Files:**
- Rename: `packages/electron-rpc/` → `packages/electron/`
- Modify: `packages/electron/package.json` `name`
- Modify: all importers across `packages/**`, `tests/**`, `website/docs/**`

**Interfaces:**
- Produces: `@enkaku/electron` (was `@enkaku/electron-rpc`).

- [ ] **Step 1: Move the directory**

```bash
cd /Users/paul/dev/yulsi/enkaku
git mv packages/electron-rpc packages/electron
```

- [ ] **Step 2: Rewrite every `@enkaku/electron-rpc` specifier**

```bash
cd /Users/paul/dev/yulsi/enkaku
FILES=$(grep -rl "@enkaku/electron-rpc" packages tests website \
  --include='*.ts' --include='*.tsx' --include='*.js' \
  --include='*.json' --include='*.md' --include='*.mdx' 2>/dev/null | grep -v '/lib/')
for f in $FILES; do
  sed -i '' 's#@enkaku/electron-rpc#@enkaku/electron#g' "$f"
done
```

- [ ] **Step 3: Verify no stale references** (outside `lib/`)

Run: `grep -rn "@enkaku/electron-rpc" packages tests website 2>/dev/null | grep -v '/lib/'`
Expected: no matches.

- [ ] **Step 4: Reinstall**

Run: `pnpm install`
Expected: clean resolve; `@enkaku/electron` present in workspace.

- [ ] **Step 5: Verify full build + test green**

Run: `pnpm run build && pnpm run test`
Expected: all green, including `tests/e2e-electron`.

- [ ] **Step 6: Commit**

```bash
git add packages tests website pnpm-lock.yaml
git commit -m "refactor: rename @enkaku/electron-rpc to @enkaku/electron"
```

---

### Task 6: Bump RPC packages to 0.18.0 and finalize

Set the 12 RPC packages to 0.18.0 via a changeset, leave MLS and frozen packages unbumped, and run the full verification gate.

**Files:**
- Create: `.changeset/enkaku-v018.md`
- Modify (via `changeset version`): `packages/{protocol,transport,client,server,standalone,http-fetch,http-serve,socket,node-streams,message,electron,react}/package.json` versions

**Interfaces:**
- Consumes: all prior tasks.
- Produces: RPC packages at 0.18.0, ready for `pnpm run release`.

- [ ] **Step 1: Write the changeset** `.changeset/enkaku-v018.md`

```markdown
---
'@enkaku/protocol': minor
'@enkaku/transport': minor
'@enkaku/client': minor
'@enkaku/server': minor
'@enkaku/standalone': minor
'@enkaku/http-fetch': minor
'@enkaku/http-serve': minor
'@enkaku/socket': minor
'@enkaku/node-streams': minor
'@enkaku/message': minor
'@enkaku/electron': minor
'@enkaku/react': minor
---

Split: deps rewired to @sozai/@kokuin, transports renamed, keystore types moved to @kokuin/token.
```

- [ ] **Step 2: Apply the version bump**

Run: `pnpm run version`
Expected: changeset rewrites the 12 RPC `package.json` versions. Confirm they read `0.18.0`:

Run: `for d in protocol transport client server standalone http-fetch http-serve socket node-streams message electron react; do node -e "console.log('$d', require('./packages/$d/package.json').version)"; done`
Expected: every line ends `0.18.0`.

- [ ] **Step 3: Confirm MLS + frozen packages were NOT bumped**

Run: `node -e "console.log('group', require('./packages/group/package.json').version, '| async', require('./packages/async/package.json').version, '| token', require('./packages/token/package.json').version)"`
Expected: `group 0.17.x | async 0.17.x | token 0.17.x` (unchanged).

- [ ] **Step 4: Reinstall + full verification gate**

Run: `pnpm install && pnpm run build && pnpm run test && rtk proxy pnpm run lint`
Expected: install clean; build green; `test:types` + `test:unit` pass; lint clean.

- [ ] **Step 5: Commit**

```bash
git add packages .changeset pnpm-lock.yaml
git commit -m "chore: bump RPC packages to 0.18.0"
```

---

## Post-plan notes

- **Not in this plan (later phases):** deleting frozen core/identity packages (P3); kumiai extracting MLS source (P2); deleting/renaming MLS packages (P2/P3); migrating `kubun`/`mokei` consumers; publishing (`pnpm run release`) — run manually after review.
- **`scripts/codemod-v018.mjs`** is a one-shot migration tool; it can be deleted in P3 cleanup (kept for now as a record / reuse for MLS extraction).
- **`apps/ledger`, `tests/ledger`** are intentionally left frozen (already mirrored in kokuin).
