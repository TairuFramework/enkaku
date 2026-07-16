# Stale Pre-Split Documentation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Stage:** planning
**Mode:** tasks

**Spec:** `docs/superpowers/specs/2026-07-16-stale-docs-cleanup-design.md`

**Goal:** Remove ~8.4k lines of pre-0.18-split guidance from `docs/reference/`, make the two surviving reference docs true against source, and ship the three orphaned skill sources as a registered `enkaku` plugin so `/enkaku:discover` works.

**Architecture:** Four independent changes. Delete the orphaned stale docs outright (git history is the archive; `discover` already routes those domains cross-repo). Verify `core-rpc.md` and `transport.md` section-by-section against `packages/*/src` using one subagent per section, applying fixes in the main thread. Move `docs/skills/*.skill.md` into `plugins/enkaku/` behind a checked-in marketplace. Re-file the website work to `backlog/`.

**Tech Stack:** Markdown docs, Claude Code plugin manifests (`marketplace.json`, `plugin.json`, `SKILL.md`), pnpm workspace with 13 packages under `packages/`.

## Global Constraints

- This is a docs-only change. No file under `packages/*/src` is modified by any task. Source is read-only — it is the source of truth, never the thing being fixed.
- A claim that cannot be confirmed against `packages/*/src` is **deleted, not rewritten and not flagged**. A shorter true doc beats a complete plausible one. Expect both kept docs to shrink.
- Dependency lines are read from the package's own `package.json`. Never hand-mapped from the old name.
- No pointer stubs for deleted files.
- Skills in the plugin use bare frontmatter names (`discover`, not `enkaku:discover`) — the `enkaku:` namespace comes from the plugin, matching kigu's convention.
- Skills cite repo-relative paths (`docs/reference/domains/core-rpc.md`). No `${CLAUDE_PLUGIN_ROOT}`.
- Work on branch `docs/stale-pre-split-cleanup`. The spec commit `bff3eeb` is already on it.
- Commit hooks run `biome` and `pnpm run -r build:types` on every commit; both should pass untouched since no TypeScript changes.

## Reference: the 13 real packages

`client`, `electron`, `http-fetch`, `http-serve`, `message`, `node-streams`, `otel`, `protocol`, `react`, `server`, `socket`, `standalone`, `transport`.

## Reference: package rename map (verified — class names survived)

| Old | New |
|---|---|
| `@enkaku/http-client-transport` | `@enkaku/http-fetch` |
| `@enkaku/http-server-transport` | `@enkaku/http-serve` |
| `@enkaku/socket-transport` | `@enkaku/socket` |
| `@enkaku/node-streams-transport` | `@enkaku/node-streams` |
| `@enkaku/message-transport` | `@enkaku/message` |
| `@enkaku/electron-rpc` | `@enkaku/electron` |

Moved out of the repo entirely (no in-repo replacement — route to the sibling repo):
`@enkaku/token`, `@enkaku/capability`, `@enkaku/*-keystore` → `@kokuin/*`.
`@enkaku/schema`, `@enkaku/stream`, `@enkaku/async`, `@enkaku/codec`, `@enkaku/event`, `@enkaku/result`, `@enkaku/flow`, `@enkaku/patch`, `@enkaku/execution`, `@enkaku/generator` → `@sozai/*`.

## Reference: real dependency lists (measured 2026-07-16 — re-read `package.json` if in doubt)

| Package | `dependencies` |
|---|---|
| `@enkaku/client` | `@enkaku/otel`, `@kokuin/token`, `@sozai/async`, `@sozai/event`, `@sozai/execution`, `@sozai/log`, `@sozai/otel`, `@sozai/runtime`, `@sozai/stream` |
| `@enkaku/server` | `@enkaku/otel`, `@enkaku/protocol`, `@kokuin/capability`, `@kokuin/token`, `@sozai/async`, `@sozai/event`, `@sozai/log`, `@sozai/otel`, `@sozai/runtime`, `@sozai/schema`, `@sozai/stream` |
| `@enkaku/protocol` | `@kokuin/token` |
| `@enkaku/standalone` | `@enkaku/client`, `@enkaku/server`, `@enkaku/transport`, `@sozai/runtime` |
| `@enkaku/transport` | `@sozai/async`, `@sozai/event`, `@sozai/stream` |
| `@enkaku/http-fetch` | `@enkaku/otel`, `@enkaku/protocol`, `@enkaku/transport`, `@sozai/otel`, `@sozai/runtime`, `@sozai/stream`, `eventsource-parser` |
| `@enkaku/http-serve` | `@enkaku/otel`, `@enkaku/protocol`, `@enkaku/transport`, `@sozai/async`, `@sozai/otel`, `@sozai/runtime`, `@sozai/stream` |
| `@enkaku/socket` | `@enkaku/otel`, `@enkaku/transport`, `@sozai/otel`, `@sozai/stream` |
| `@enkaku/node-streams` | `@sozai/stream`, `@enkaku/transport` |
| `@enkaku/message` | `@enkaku/transport` |
| `@enkaku/electron` | `@enkaku/client`, `@enkaku/server`, `@enkaku/transport` |

---

### Task 1: Delete the orphaned stale docs

Nine files, ~8.4k lines, zero referrers. `discover.skill.md` already stopped routing to these domains and carries a *Cross-repo* section pointing at `/kokuin:*`, `/sozai:*`, and `@kumiai`.

**Files:**
- Delete: `docs/reference/domains/authentication.md` (1364 lines)
- Delete: `docs/reference/domains/streaming.md` (1067)
- Delete: `docs/reference/domains/validation.md` (1762)
- Delete: `docs/reference/domains/hub-tunnel.md` (123)
- Delete: `docs/reference/use-cases/` entire directory — `building-rpc-server.md` (532), `handling-streaming-data.md` (902), `real-time-communication.md` (802), `securing-endpoints.md` (1016), `validating-requests.md` (899), and `.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/reference/domains/` containing exactly `core-rpc.md`, `transport.md`, `replay-protection.md`, `.gitkeep`. Tasks 2 and 3 edit the first two; Task 4's skills link to all three.

- [ ] **Step 1: Confirm zero referrers before deleting**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -rn "authentication\.md\|streaming\.md\|validation\.md\|hub-tunnel\.md\|use-cases/" \
  --include='*.md' --include='*.ts' --include='*.json' \
  docs/skills AGENTS.md CLAUDE.md docs/index.md .claude/ 2>/dev/null
```

Expected: no output. If anything prints, stop — a referrer exists that the spec did not account for, and it must be resolved before deleting.

- [ ] **Step 2: Delete the files**

```bash
cd /Users/paul/dev/yulsi/enkaku
git rm -q docs/reference/domains/authentication.md \
          docs/reference/domains/streaming.md \
          docs/reference/domains/validation.md \
          docs/reference/domains/hub-tunnel.md
git rm -rq docs/reference/use-cases
```

- [ ] **Step 3: Verify what survives**

```bash
cd /Users/paul/dev/yulsi/enkaku
ls docs/reference/domains/
ls docs/reference/
```

Expected: `domains/` holds `core-rpc.md`, `transport.md`, `replay-protection.md` (and `.gitkeep`). `docs/reference/` holds only `domains/`. No `use-cases/`.

- [ ] **Step 4: Verify the stale-package surface shrank**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -rlc "@enkaku/token\|@enkaku/schema\|@enkaku/stream\|@enkaku/capability" docs/reference/ 2>/dev/null
```

Expected: only `docs/reference/domains/core-rpc.md` and `docs/reference/domains/transport.md` appear. Those are Tasks 2 and 3.

- [ ] **Step 5: Commit**

```bash
cd /Users/paul/dev/yulsi/enkaku
git commit -q -m "docs: delete pre-split reference docs for moved domains

The 0.18 split moved auth/tokens to @kokuin, schema/stream to @sozai, and
MLS/hub to @kumiai. These nine documents describe packages this repo no
longer ships, and nothing references them -- the discover skill stopped
routing to these domains and points at the sibling repos instead.

Removed: domains/{authentication,streaming,validation,hub-tunnel}.md and
all five use-cases/ documents. Git history is the archive.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Verify and fix `transport.md` against source

932 lines, 20 stale package references. Documents 5 transports; 6 exist — `@enkaku/electron` is missing entirely.

Both kept docs share the same 7-section structure. Sections are addressed by heading, not line number, because line numbers shift as earlier sections are edited.

**Files:**
- Modify: `docs/reference/domains/transport.md`
- Read-only: `packages/{transport,http-fetch,http-serve,socket,node-streams,message,electron}/src/index.ts`, and each package's `package.json`

**Interfaces:**
- Consumes: the rename map and dependency table above.
- Produces: a `transport.md` whose every import, dependency line, and API claim is confirmed against source. Task 4's `transport/SKILL.md` links to it.

- [ ] **Step 1: Dispatch one verification subagent per section**

Six sections need verification. `## Overview` (4 lines) is prose with no API claims — read it yourself and fix only if it names a removed package.

Dispatch these six in parallel, one subagent each. Use this prompt, substituting the section name:

```
Read `docs/reference/domains/transport.md` in /Users/paul/dev/yulsi/enkaku and
extract ONLY the section `## <SECTION NAME>` (up to the next `## ` heading).

Verify every claim in that section against the actual source in `packages/*/src`
and `packages/*/package.json`. The repo ships exactly 13 packages: client,
electron, http-fetch, http-serve, message, node-streams, otel, protocol, react,
server, socket, standalone, transport.

For EVERY claim -- every import path, every dependency line, every exported name,
every function signature, every option/parameter, every described behavior --
report one row:

  CONFIRMED   | <quote the claim> | <file:line in packages/ proving it>
  WRONG       | <quote the claim> | <the correct value> | <file:line>
  UNVERIFIABLE| <quote the claim> | <what you searched and did not find>

Rules:
- Do NOT edit any file. Report only.
- Do NOT guess. If a claim describes behavior you cannot locate in source, it is
  UNVERIFIABLE, not CONFIRMED.
- Package renames to check: http-client-transport->http-fetch,
  http-server-transport->http-serve, socket-transport->socket,
  node-streams-transport->node-streams, message-transport->message,
  electron-rpc->electron. Class names survived the rename; verify each one still
  exists and is still exported.
- Packages that LEFT this repo (@enkaku/token, /schema, /stream, /capability,
  /async, /codec, /event, /result, /flow, /patch, /execution, /generator, and any
  *-keystore) now live in @kokuin/* or @sozai/*. A claim depending on one of these
  as an @enkaku package is WRONG; give the real value from package.json.
- Recent commits changed lifecycle behavior (d464198 abort signal and resource
  release, e90fd13 socket connect and dispose). Treat lifecycle prose with
  suspicion and verify against current source.
```

Sections to dispatch:
1. `## Package Ecosystem`
2. `## Common Patterns`
3. `## Package Interactions`
4. `## API Quick Reference`
5. `## Examples by Scenario`
6. `## Troubleshooting`

- [ ] **Step 2: Apply the findings**

For each returned row:
- CONFIRMED → leave the text alone.
- WRONG → replace with the reported correct value.
- UNVERIFIABLE → **delete the claim.** Per Global Constraints: cut, don't flag, don't rewrite from imagination. If deleting a claim empties a subsection, delete the subsection heading too.

Do not add new content in this step beyond the corrections themselves.

- [ ] **Step 3: Add the missing `@enkaku/electron` transport**

`transport.md` documents 5 transports; 6 exist. Add an `@enkaku/electron` entry to `## Package Ecosystem` matching the shape of the entries already there. Source of truth: `packages/electron/src/index.ts` and `packages/electron/package.json` (dependencies: `@enkaku/client`, `@enkaku/server`, `@enkaku/transport`). Write only what the source confirms — if the surrounding entries carry detail you cannot verify for electron, omit that detail rather than inventing it.

- [ ] **Step 4: Verify no removed package survives**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -n "@enkaku/token\|@enkaku/schema\|@enkaku/stream\|@enkaku/capability\|@enkaku/async\|@enkaku/codec\|@enkaku/event\|@enkaku/result\|@enkaku/flow\|@enkaku/patch\|@enkaku/execution\|@enkaku/generator\|keystore\|-transport\|electron-rpc" docs/reference/domains/transport.md
```

Expected: no output.

- [ ] **Step 5: Verify every remaining `@enkaku/` mention is a real package**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -o "@enkaku/[a-z-]*" docs/reference/domains/transport.md | sort -u
```

Expected: every line names one of the 13 real packages. Cross-check against `ls packages/`.

- [ ] **Step 6: Verify dependency lines match manifests**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -n "^\*\*Dependencies\*\*" docs/reference/domains/transport.md
```

For each line, compare against that package's `package.json` `dependencies` (see the table in this plan). Every entry must match exactly — no extras, no omissions.

- [ ] **Step 7: Commit**

```bash
cd /Users/paul/dev/yulsi/enkaku
git add docs/reference/domains/transport.md
git commit -q -m "docs: verify transport reference against source

Every import, dependency line, and API claim in transport.md checked
against packages/*/src. Renamed the transport packages to their post-split
names, corrected dependency lines from each package.json, and added the
@enkaku/electron transport, which was missing entirely.

Claims that could not be confirmed against source were removed rather than
rewritten -- a shorter true document beats a complete plausible one.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Verify and fix `core-rpc.md` against source

1537 lines, 7 stale package references. Same structure and method as Task 2, different packages.

**Files:**
- Modify: `docs/reference/domains/core-rpc.md`
- Read-only: `packages/{protocol,client,server,standalone,transport,http-fetch,http-serve}/src/index.ts`, and each package's `package.json`

**Interfaces:**
- Consumes: the rename map and dependency table above.
- Produces: a `core-rpc.md` whose every import, dependency line, and API claim is confirmed against source. Task 4's `core-rpc/SKILL.md` links to it.

- [ ] **Step 1: Dispatch one verification subagent per section**

Six sections. `## Overview` (6 lines) is prose with no API claims — read it yourself and fix only if it names a removed package.

Dispatch these six in parallel, one subagent each. Use this prompt, substituting the section name:

```
Read `docs/reference/domains/core-rpc.md` in /Users/paul/dev/yulsi/enkaku and
extract ONLY the section `## <SECTION NAME>` (up to the next `## ` heading).

Verify every claim in that section against the actual source in `packages/*/src`
and `packages/*/package.json`. The repo ships exactly 13 packages: client,
electron, http-fetch, http-serve, message, node-streams, otel, protocol, react,
server, socket, standalone, transport.

For EVERY claim -- every import path, every dependency line, every exported name,
every function signature, every option/parameter, every described behavior --
report one row:

  CONFIRMED   | <quote the claim> | <file:line in packages/ proving it>
  WRONG       | <quote the claim> | <the correct value> | <file:line>
  UNVERIFIABLE| <quote the claim> | <what you searched and did not find>

Rules:
- Do NOT edit any file. Report only.
- Do NOT guess. If a claim describes behavior you cannot locate in source, it is
  UNVERIFIABLE, not CONFIRMED.
- Package renames to check: http-client-transport->http-fetch,
  http-server-transport->http-serve, socket-transport->socket,
  node-streams-transport->node-streams, message-transport->message,
  electron-rpc->electron. Class names survived the rename; verify each one still
  exists and is still exported.
- Packages that LEFT this repo (@enkaku/token, /schema, /stream, /capability,
  /async, /codec, /event, /result, /flow, /patch, /execution, /generator, and any
  *-keystore) now live in @kokuin/* or @sozai/*. A claim depending on one of these
  as an @enkaku package is WRONG; give the real value from package.json.
- Recent commits changed lifecycle behavior (d464198 abort signal and resource
  release, e90fd13 socket connect and dispose). Treat lifecycle prose with
  suspicion and verify against current source.
- Access control moved: the server takes token/capability identities from
  @kokuin/token and @kokuin/capability. Verify any auth-related claim against
  packages/server/src rather than assuming the pre-split shape.
```

Sections to dispatch:
1. `## Package Ecosystem`
2. `## Common Patterns`
3. `## Package Interactions`
4. `## API Quick Reference`
5. `## Examples by Scenario`
6. `## Troubleshooting`

- [ ] **Step 2: Apply the findings**

For each returned row:
- CONFIRMED → leave the text alone.
- WRONG → replace with the reported correct value.
- UNVERIFIABLE → **delete the claim.** Per Global Constraints: cut, don't flag, don't rewrite from imagination. If deleting a claim empties a subsection, delete the subsection heading too.

- [ ] **Step 3: Verify no removed package survives**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -n "@enkaku/token\|@enkaku/schema\|@enkaku/stream\|@enkaku/capability\|@enkaku/async\|@enkaku/codec\|@enkaku/event\|@enkaku/result\|@enkaku/flow\|@enkaku/patch\|@enkaku/execution\|@enkaku/generator\|keystore\|-transport\|electron-rpc" docs/reference/domains/core-rpc.md
```

Expected: no output.

- [ ] **Step 4: Verify every remaining `@enkaku/` mention is a real package**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -o "@enkaku/[a-z-]*" docs/reference/domains/core-rpc.md | sort -u
```

Expected: every line names one of the 13 real packages.

- [ ] **Step 5: Verify dependency lines match manifests**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -n "^\*\*Dependencies\*\*" docs/reference/domains/core-rpc.md
```

Compare each against the package's `package.json`. Note `@enkaku/protocol` depends on exactly one package: `@kokuin/token`.

- [ ] **Step 6: Commit**

```bash
cd /Users/paul/dev/yulsi/enkaku
git add docs/reference/domains/core-rpc.md
git commit -q -m "docs: verify core RPC reference against source

Every import, dependency line, and API claim in core-rpc.md checked against
packages/*/src. Corrected dependency lines from each package.json -- auth
types now come from @kokuin/*, utilities from @sozai/* -- and repointed the
transport imports at their post-split package names.

Claims that could not be confirmed against source were removed rather than
rewritten.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Ship the skills as a registered plugin

`docs/skills/` holds three post-split-current skill sources that nothing serves, so `AGENTS.md`'s `/enkaku:discover` instruction is dead. kigu's `discover-template` names the intended mechanism: a local plugin. kigu is the working precedent — its own `.claude/settings.json` registers `source: github, repo: TairuFramework/kigu`, pointing at itself.

Local/relative marketplace sources do **not** work from `extraKnownMarketplaces` (only via a manual `/plugin marketplace add ./`), so the checked-in source must be `github`. Consequence: the plugin resolves from GitHub HEAD, not the working tree, so `/enkaku:discover` cannot be invoked locally until this branch is merged and pushed. Verification here is by inspection; live invocation is a post-merge check.

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/enkaku/.claude-plugin/plugin.json`
- Create: `plugins/enkaku/skills/discover/SKILL.md` (from `docs/skills/discover.skill.md`)
- Create: `plugins/enkaku/skills/core-rpc/SKILL.md` (from `docs/skills/core-rpc.skill.md`)
- Create: `plugins/enkaku/skills/transport/SKILL.md` (from `docs/skills/transport.skill.md`)
- Modify: `.claude/settings.json`
- Delete: `docs/skills/` entire directory

**Interfaces:**
- Consumes: `docs/reference/domains/{core-rpc,transport,replay-protection}.md` — the skills link to these by repo-relative path. Tasks 2 and 3 must land first so the links point at verified content.
- Produces: `/enkaku:discover`, `/enkaku:core-rpc`, `/enkaku:transport` (post-merge).

- [ ] **Step 1: Create the marketplace manifest**

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "enkaku",
  "owner": { "name": "Paul Le Cam" },
  "plugins": [
    {
      "name": "enkaku",
      "source": "./plugins/enkaku",
      "description": "Enkaku RPC discovery and domain skills."
    }
  ]
}
```

- [ ] **Step 2: Create the plugin manifest**

Create `plugins/enkaku/.claude-plugin/plugin.json`:

```json
{
  "name": "enkaku",
  "version": "0.1.0",
  "description": "Enkaku RPC discovery and domain skills: protocol, client, server, and transports.",
  "author": { "name": "Paul Le Cam" }
}
```

- [ ] **Step 3: Move the discover skill**

```bash
cd /Users/paul/dev/yulsi/enkaku
mkdir -p plugins/enkaku/skills/discover
git mv docs/skills/discover.skill.md plugins/enkaku/skills/discover/SKILL.md
```

Then replace its frontmatter. The namespace comes from the plugin, so the name is bare — `enkaku:discover` in frontmatter would yield `/enkaku:enkaku:discover`.

Old:
```yaml
---
name: enkaku:discover
description: Explore Enkaku RPC capabilities by domain or use case
---
```

New:
```yaml
---
name: discover
description: Use when exploring Enkaku RPC capabilities - progressive discovery of this repo's domain skills.
---
```

Leave the body as-is. It is post-split current, and its package overview and *Cross-repo* section carry more than the template's minimal shape — the template is a starting point for repos that have nothing, not a ceiling.

- [ ] **Step 4: Add replay protection to the discover skill's Core RPC entry**

In `plugins/enkaku/skills/discover/SKILL.md`, the Core RPC domain bullet currently reads:

```
- **Core RPC** — protocol definitions, client, server, standalone.
  Define a protocol once and get typed clients and servers: the four procedure types
  (request, event, stream, channel), handler registration, execution chains, access control,
  and lifecycle events.
  → `/enkaku:core-rpc`
```

Add replay protection to that list so the domain's coverage is discoverable:

```
- **Core RPC** — protocol definitions, client, server, standalone.
  Define a protocol once and get typed clients and servers: the four procedure types
  (request, event, stream, channel), handler registration, execution chains, access control,
  replay protection, and lifecycle events.
  → `/enkaku:core-rpc`
```

- [ ] **Step 5: Move the core-rpc skill**

```bash
cd /Users/paul/dev/yulsi/enkaku
mkdir -p plugins/enkaku/skills/core-rpc
git mv docs/skills/core-rpc.skill.md plugins/enkaku/skills/core-rpc/SKILL.md
```

Replace the frontmatter:

Old:
```yaml
---
name: enkaku:core-rpc
description: Core RPC patterns - protocol definitions, client/server setup, and type-safe calls
---
```

New:
```yaml
---
name: core-rpc
description: Use when working on Enkaku protocol definitions, client/server setup, handlers, or type-safe calls.
---
```

- [ ] **Step 6: Add the replay-protection pointer to the core-rpc skill**

The last line of `plugins/enkaku/skills/core-rpc/SKILL.md` currently reads:

```
For complete API documentation, advanced patterns, and troubleshooting: `docs/reference/domains/core-rpc.md`
```

Replace with:

```
For complete API documentation, advanced patterns, and troubleshooting: `docs/reference/domains/core-rpc.md`

For replay protection — the server-side dedup layer, the `ReplayCache` interface, and the
`EK09` (`REPLAY_DETECTED`) error: `docs/reference/domains/replay-protection.md`
```

- [ ] **Step 7: Move the transport skill**

```bash
cd /Users/paul/dev/yulsi/enkaku
mkdir -p plugins/enkaku/skills/transport
git mv docs/skills/transport.skill.md plugins/enkaku/skills/transport/SKILL.md
```

Replace the frontmatter:

Old:
```yaml
---
name: enkaku:transport
description: Transport layer patterns, packages, and usage examples
---
```

New:
```yaml
---
name: transport
description: Use when choosing or configuring an Enkaku transport - HTTP, WebSocket, Node streams, MessagePort, or Electron IPC.
---
```

Leave the `docs/reference/domains/transport.md` pointer on its last line as-is — Task 2 verified that file in place.

- [ ] **Step 8: Register the plugin**

Modify `.claude/settings.json`. It currently reads:

```json
{
  "extraKnownMarketplaces": {
    "kigu": {
      "source": { "source": "github", "repo": "TairuFramework/kigu" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": { "kigu@kigu": true }
}
```

Add the `enkaku` marketplace and enable the plugin:

```json
{
  "extraKnownMarketplaces": {
    "kigu": {
      "source": { "source": "github", "repo": "TairuFramework/kigu" },
      "autoUpdate": true
    },
    "enkaku": {
      "source": { "source": "github", "repo": "TairuFramework/enkaku" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "kigu@kigu": true,
    "enkaku@enkaku": true
  }
}
```

- [ ] **Step 9: Remove the now-empty docs/skills directory**

```bash
cd /Users/paul/dev/yulsi/enkaku
git rm -q docs/skills/.gitkeep
ls docs/skills 2>&1
```

Expected: `ls: docs/skills: No such file or directory`. The three `.skill.md` files were moved by `git mv` in Steps 3, 5, and 7.

- [ ] **Step 10: Verify the manifests are internally consistent**

```bash
cd /Users/paul/dev/yulsi/enkaku
node -e "
const mk = require('./.claude-plugin/marketplace.json');
const pl = require('./plugins/enkaku/.claude-plugin/plugin.json');
const st = require('./.claude/settings.json');
const entry = mk.plugins.find(p => p.name === 'enkaku');
console.log('marketplace source resolves:', require('fs').existsSync(entry.source));
console.log('plugin.json name matches marketplace entry:', pl.name === entry.name);
console.log('settings key matches <plugin>@<marketplace>:', st.enabledPlugins['enkaku@enkaku'] === true);
console.log('marketplace registered in settings:', !!st.extraKnownMarketplaces.enkaku);
"
```

Expected: four lines, all `true`.

- [ ] **Step 11: Verify skill frontmatter and links**

```bash
cd /Users/paul/dev/yulsi/enkaku
head -4 plugins/enkaku/skills/*/SKILL.md
```

Expected: three blocks with bare names `discover`, `core-rpc`, `transport` — no `enkaku:` prefix in any `name:` field.

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -oh "docs/reference/domains/[a-z-]*\.md" plugins/enkaku/skills/*/SKILL.md | sort -u | while read -r f; do
  test -f "$f" && echo "OK   $f" || echo "DEAD $f"
done
```

Expected: `OK` for `core-rpc.md`, `transport.md`, `replay-protection.md`. No `DEAD` lines.

- [ ] **Step 12: Commit**

```bash
cd /Users/paul/dev/yulsi/enkaku
git add .claude-plugin plugins .claude/settings.json docs/skills
git commit -q -m "docs: ship discovery skills as an enkaku plugin

docs/skills/ held three current skill sources that nothing served, so the
/enkaku:discover instruction in AGENTS.md pointed at a skill that was never
registered. Move them into plugins/enkaku/ behind a checked-in marketplace,
following kigu's precedent.

Frontmatter names drop the enkaku: prefix -- the namespace comes from the
plugin, so keeping it would yield /enkaku:enkaku:discover.

The marketplace source must be github rather than a relative path: local
sources only work through a manual 'plugin marketplace add', which a
checked-in config cannot rely on. The plugin therefore resolves from GitHub
HEAD, so the skills load only once this lands on main.

Also routes the Core RPC domain to replay-protection.md, which was accurate
but unreachable.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Re-file the website work and update the roadmap

The `next/` item bundled the website with the reference docs. The website is a rewrite, not a cleanup, and belongs in `backlog/` with its own measurements.

**Files:**
- Create: `docs/agents/plans/backlog/2026-07-16-website-post-split-rewrite.md`
- Delete: `docs/agents/plans/next/2026-07-07-stale-docs-cleanup.md`
- Modify: `docs/agents/plans/roadmap.md:38-39`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Bookkeeping only.

- [ ] **Step 1: Write the backlog item**

Create `docs/agents/plans/backlog/2026-07-16-website-post-split-rewrite.md`:

```markdown
# Website post-split rewrite

**Origin:** split out of `next/2026-07-07-stale-docs-cleanup.md` on 2026-07-16. That item
assumed the website needed a cleanup; scoping found a rewrite. The reference-docs half was
completed separately (`docs/superpowers/specs/2026-07-16-stale-docs-cleanup-design.md`).

The 0.18 split removed 14 of the packages the site documents and renamed every transport.
The site still describes the pre-split world throughout.

## Generated API docs

- `website/tsconfig.docs.json` lists 27 typedoc `entryPoints`; 14 point at packages that no
  longer exist (`browser-keystore`, `capability`, `electron-keystore`, `electron-rpc`,
  `expo-keystore`, `http-client-transport`, `http-server-transport`, `message-transport`,
  `node-keystore`, `node-streams-transport`, `schema`, `socket-transport`, `stream`,
  `token`, and the `@sozai`-bound utilities `async`, `codec`, `event`, `execution`, `flow`,
  `generator`, `patch`, `result`).
- Missing entirely: `http-fetch`, `http-serve`, `otel`, `react`.
- `website/docs/api/` holds committed typedoc output for the removed packages.
- `website/sidebars.ts` links ~24 dead API pages under `Core`, `RPC`, `Transports`,
  `Key stores`, and `Miscellaneous`.

The repo ships 13 packages: `client`, `electron`, `http-fetch`, `http-serve`, `message`,
`node-streams`, `otel`, `protocol`, `react`, `server`, `socket`, `standalone`, `transport`.

## Prose

Every prose page imports at least one removed package: `communications.mdx`,
`validation.mdx`, `security.mdx`, `api.mdx`, `examples/stateless-http.mdx`,
`examples/stateful-http.mdx`, `guides/http-transports.mdx`, `guides/custom-transports.mdx`,
`guides/key-management.mdx`.

`validation.mdx` and `guides/key-management.mdx` are whole pages about domains that left the
repo — they likely belong to `@sozai` and `@kokuin` respectively rather than being rewritten
here.

## Open questions

- Do keystore/token/schema pages move to the sibling repos' sites, or does enkaku's site link
  out to them?
- Should `website/docs/api/` stay committed, or be generated at build time and gitignored?
  It is currently committed and stale, which is the worst of both.
```

- [ ] **Step 2: Delete the superseded next/ item**

```bash
cd /Users/paul/dev/yulsi/enkaku
git rm -q docs/agents/plans/next/2026-07-07-stale-docs-cleanup.md
```

- [ ] **Step 3: Update the roadmap**

`docs/agents/plans/roadmap.md` lines 38-39 currently read:

```markdown
- **Stale docs cleanup** — ~8k lines of pre-split guidance in `docs/reference/` and
  `website/`; regenerate typedoc output. `next/2026-07-07-stale-docs-cleanup.md`
```

That entry is in the `next/` list. Remove those two lines from `next/`, and add this to the `Backlog:` list instead (the reference-docs half is done; only the website remains):

```markdown
- **Website post-split rewrite** — typedoc lists 14 packages that no longer exist, sidebars
  link ~24 dead API pages, and every prose page imports a removed package.
  `backlog/2026-07-16-website-post-split-rewrite.md`
```

- [ ] **Step 4: Verify no dangling references**

```bash
cd /Users/paul/dev/yulsi/enkaku
grep -rn "2026-07-07-stale-docs-cleanup" docs/ 2>/dev/null
```

Expected: hits only under `docs/agents/plans/completed/` (historical audit records, which correctly describe what was true then). No hits in `roadmap.md` or `next/`.

- [ ] **Step 5: Commit**

```bash
cd /Users/paul/dev/yulsi/enkaku
git add docs/agents/plans
git commit -q -m "docs: split the website rewrite out of the stale-docs item

The next/ item bundled the website with the reference docs on the assumption
both needed a cleanup. Scoping found the website needs a rewrite: typedoc
lists 14 packages that no longer exist, sidebars link ~24 dead API pages, and
every prose page imports a removed package.

The reference-docs half is done; the website half moves to backlog/ with its
measurements and open questions recorded.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- [ ] `docs/reference/domains/` holds exactly `core-rpc.md`, `transport.md`, `replay-protection.md`. No `use-cases/`.
- [ ] `grep -rn` for every removed package name across `docs/` returns hits only under `docs/agents/plans/` (historical records) and `docs/superpowers/` (this spec and plan).
- [ ] Every `**Dependencies**:` line in both kept docs matches that package's `package.json`.
- [ ] Every `@enkaku/` import in both kept docs names one of the 13 real packages.
- [ ] `transport.md` documents all 6 transports including `@enkaku/electron`.
- [ ] `plugins/enkaku/` manifests are consistent and every skill's `docs/reference/` link resolves.
- [ ] `docs/skills/` is gone.
- [ ] `docs/index.md`'s `reference/` link still resolves.
- [ ] Post-merge only: `/enkaku:discover` loads in a fresh session and routes to `/enkaku:core-rpc` and `/enkaku:transport`.
