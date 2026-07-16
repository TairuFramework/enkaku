# Stale pre-split documentation cleanup — design

**Date:** 2026-07-16
**Origin:** `docs/agents/plans/next/2026-07-07-stale-docs-cleanup.md`, itself from the 2026-07-03 repo audit (priority 4).

## Problem

The 0.18 stack split moved identity/auth to `@kokuin/*`, schema/stream/async utilities to `@sozai/*`, and MLS/hub to `@kumiai/*`, and renamed every transport package. `docs/reference/` — the first place agents look — still describes the pre-split world across ~11.9k lines. Agents reading it get confident wrong answers about packages that no longer exist.

A second, compounding problem: `docs/skills/` holds three post-split-current skill sources (`discover`, `core-rpc`, `transport`) that nothing serves. `AGENTS.md` tells agents to run `/enkaku:discover`, but no such skill is registered. The promise is dead on arrival.

## Scope

In scope: `docs/reference/` and skill delivery.

Out of scope: `website/`. The audit note understated it — every prose page (`communications.mdx`, `validation.mdx`, `security.mdx`, `api.mdx`, both examples, all three guides) imports removed packages; `tsconfig.docs.json` lists 27 typedoc `entryPoints` of which 14 no longer exist; `sidebars.ts` links ~24 dead API pages. That is a rewrite of the public site, not a cleanup, and gets its own spec/plan cycle. This design ends by filing it to `backlog/`.

## Current state

`docs/reference/` measured 2026-07-16:

| Doc | Lines | Stale package refs | Referrers |
|---|---|---|---|
| `domains/authentication.md` | 1364 | 41 | none |
| `domains/streaming.md` | 1067 | 43 | none |
| `domains/validation.md` | 1762 | 33 | none |
| `domains/hub-tunnel.md` | 123 | 0, but documents `@kumiai`'s domain | none |
| `use-cases/building-rpc-server.md` | 532 | 8 | none |
| `use-cases/handling-streaming-data.md` | 902 | 11 | none |
| `use-cases/real-time-communication.md` | 802 | 8 | none |
| `use-cases/securing-endpoints.md` | 1016 | 17 | none |
| `use-cases/validating-requests.md` | 899 | 12 | none |
| `domains/core-rpc.md` | 1537 | 7 | `docs/skills/core-rpc.skill.md:379` |
| `domains/transport.md` | 932 | 20 | `docs/skills/transport.skill.md:241` |
| `domains/replay-protection.md` | 271 | 0 — current and accurate | none |

The repo ships 13 packages: `client`, `electron`, `http-fetch`, `http-serve`, `message`, `node-streams`, `otel`, `protocol`, `react`, `server`, `socket`, `standalone`, `transport`.

`docs/skills/discover.skill.md` is already post-split current: it routes only to `/enkaku:transport` and `/enkaku:core-rpc`, and carries a *Cross-repo* section pointing at `/kokuin:*`, `/sozai:*`, and `@kumiai`. The stale domain docs are orphans it deliberately stopped routing to.

## Part 1 — Delete the orphans

Delete 9 files, ~8.4k lines:

- `docs/reference/domains/{authentication,streaming,validation,hub-tunnel}.md`
- all of `docs/reference/use-cases/` including `.gitkeep`

No pointer stubs. Cross-repo routing already lives in `discover.skill.md`; stubs would duplicate it into 9 files that must stay in sync. Git history keeps the content recoverable.

Survivors in `docs/reference/domains/`: `core-rpc.md`, `transport.md`, `replay-protection.md`.

## Part 2 — Verify the two kept docs against source

`core-rpc.md` and `transport.md` claim to be *"complete API documentation"*. They predate both the split and recent lifecycle work (`d464198` abort signal and resource release, `e90fd13` socket connect and dispose). Fixing only their imports would make them *look* current while leaving unverified API claims in place — worse than obviously stale, because nothing signals distrust.

Three classes of claim, each with a source of truth:

1. **Dependency lines** (`**Dependencies**: ...`) — read from the package's own `package.json`. Never hand-mapped. Pre-split names resolve across repos (`@enkaku/stream` → `@sozai/*`, `@enkaku/token` → `@kokuin/*`) and only the manifest is authoritative.
2. **Import lines and exported names** — check against `packages/*/src/index.ts`. Class names survived the split (`SocketTransport`, `MessageTransport`, `NodeStreamsTransport`, `ClientTransport`, `ServerTransport`), so package renames are mechanical: `http-client-transport` → `http-fetch`, `http-server-transport` → `http-serve`, `socket-transport` → `socket`, `node-streams-transport` → `node-streams`, `message-transport` → `message`, `electron-rpc` → `electron`.
3. **Prose and code blocks** — signatures, option shapes, lifecycle and error behavior. The real risk, and not mechanical.

Rule for class 3: a claim that cannot be confirmed against `packages/*/src` is cut, not guessed. A shorter doc that is true beats a complete doc that is plausible.

Known gap: `transport.md` documents 5 transports; 6 exist. `@enkaku/electron` is absent.

### Method

Subagent per doc section. Each subagent gets one section plus the source it describes, and reports per claim: confirmed / wrong (with the correct value) / unverifiable. The main thread applies edits.

Rationale: 2469 lines against 13 packages does not fit one context reliably; accuracy would degrade through the back half of a sequential pass. Splitting keeps each agent's working set small and makes findings independently checkable. Regenerating wholesale from source was rejected — these docs carry hand-written prose (threat models, trade-off discussion) that source cannot reproduce.

## Part 3 — Ship the skills as a local plugin

kigu's `discover-template` skill states the intended mechanism: *"Copy this into a runtime repo's local plugin as `skills/discover/SKILL.md`"*. `docs/skills/` is a pre-template artifact that was never migrated. kigu itself is the working precedent (`plugins/kigu/` + `.claude-plugin/marketplace.json`, enabled through `.claude/settings.json`).

Create:

- `.claude-plugin/marketplace.json` at repo root, listing one plugin: `{"name": "enkaku", "source": "./plugins/enkaku"}`
- `plugins/enkaku/.claude-plugin/plugin.json`
- `plugins/enkaku/skills/{discover,core-rpc,transport}/SKILL.md` — content from the three `docs/skills/*.skill.md` sources, frontmatter reframed per `discover-template`
- `.claude/settings.json` wiring alongside the existing `kigu@kigu` entry:

```json
{
  "extraKnownMarketplaces": {
    "enkaku": { "source": { "source": "github", "repo": "TairuFramework/enkaku" }, "autoUpdate": true }
  },
  "enabledPlugins": { "enkaku@enkaku": true }
}
```

Then delete `docs/skills/`.

The `github` source is not a stylistic choice. Relative/local marketplace sources are not supported from `extraKnownMarketplaces` — they work only through a manual `/plugin marketplace add ./`, which a checked-in config cannot rely on. kigu registers its own marketplace the same way, pointing at `TairuFramework/kigu`.

**Consequence:** the plugin resolves from GitHub HEAD, not the working tree. Edits to `plugins/enkaku/skills/*` do not load locally until pushed and the marketplace refreshes, so `/enkaku:discover` cannot be exercised before merge. This is the constraint kigu already lives with. The skill sources are reviewable as files; live invocation is a post-merge check.

Plain `.claude/skills/<name>/SKILL.md` was ruled out on evidence, not preference: project skills cannot be namespaced, and are always invoked bare (`/discover`). They cannot satisfy `AGENTS.md`'s `/enkaku:discover`.

Skills keep repo-relative reference paths (`docs/reference/domains/core-rpc.md`). The plugin lives in-repo and agents run from the repo root, so those resolve without `${CLAUDE_PLUGIN_ROOT}`.

Two content changes while moving:

- `core-rpc/SKILL.md` gains a pointer to `docs/reference/domains/replay-protection.md` beside its existing `core-rpc.md` link.
- `discover/SKILL.md` mentions replay protection under the Core RPC domain.

Replay protection stays a reference doc rather than becoming a third domain skill — 271 lines is thin justification for a domain, and it is a server-side feature the Core RPC domain already covers.

Outcome: `AGENTS.md`'s `/enkaku:discover` reference becomes true. `kokuin` and `sozai` carry the identical unwired `docs/skills/`; this establishes the pattern for them, but migrating them is not in this scope.

## Part 4 — File the website work

Write `docs/agents/plans/backlog/website-post-split-rewrite.md` covering typedoc `entryPoints`, `sidebars.ts`, and the prose pages, with the measurements above. Delete `docs/agents/plans/next/2026-07-07-stale-docs-cleanup.md` once this spec is committed.

## Verification

- `grep -rn` for every removed package name (`@enkaku/token`, `@enkaku/schema`, `@enkaku/stream`, `@enkaku/capability`, `@enkaku/*-keystore`, `@enkaku/*-transport`, `@enkaku/electron-rpc`, `@enkaku/{async,codec,event,result,flow,patch,execution,generator}`) across `docs/` returns hits only in `docs/agents/plans/` history.
- Every `**Dependencies**:` line in the two kept docs matches that package's `package.json`.
- Every import in a code block names a package that exists in `packages/`.
- `docs/index.md`'s `reference/` link still resolves; `docs/skills/` is gone with no dangling referrers.
- Pre-merge, the plugin is checked by inspection: `marketplace.json` `source` path resolves to `plugins/enkaku`, `plugin.json` name matches the `enkaku@enkaku` key in settings, each `SKILL.md` has valid frontmatter, and every repo-relative path a skill cites exists.
- Post-merge, `/enkaku:discover` loads in a fresh session and routes to `/enkaku:core-rpc` and `/enkaku:transport`. This cannot be verified earlier — see Part 3.

## Explicitly not doing

- Rewriting the deleted use-case docs against current packages — `discover.skill.md` covers those use cases inline.
- Pointer stubs for deleted files.
- Any `website/` change.
- Migrating `kokuin`/`sozai` skills to plugins.
