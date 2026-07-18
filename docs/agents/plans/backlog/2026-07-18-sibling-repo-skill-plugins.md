# Migrate sibling-repo skills to local plugins

**Priority:** backlog, low.
**Origin:** 2026-07-18, out of scope of the enkaku skill migration
(`completed/2026-07-18-stale-docs-cleanup.complete.md`).

`kokuin` and `sozai` each carry a `docs/skills/` directory of skill sources that nothing serves,
the same pre-template artifact enkaku had. Any `AGENTS.md` instruction to run `/kokuin:*` or
`/sozai:*` is currently false, and enkaku's discover skill now routes to those namespaces.

Enkaku established the working pattern:

- `.claude-plugin/marketplace.json` at repo root listing one plugin with a relative `source`
- `plugins/<name>/.claude-plugin/plugin.json`
- `plugins/<name>/skills/<skill>/SKILL.md` with **bare** frontmatter names -- the namespace comes
  from the plugin, so `name: kokuin:auth` would yield `/kokuin:kokuin:auth`
- `.claude/settings.json` registering the marketplace with a **`github`** source and enabling
  `<name>@<name>`

The `github` source is not stylistic: relative marketplace sources are not supported from
`extraKnownMarketplaces`, only through a manual `/plugin marketplace add`, which a checked-in
config cannot rely on. The consequence is that the plugin resolves from GitHub HEAD, so skills
cannot be exercised locally before merge.

**Verify the skill content against source before shipping it.** Enkaku's audit recorded its skill
content as post-split current; it was not. Every transport import used a pre-split package name,
six server constructions would have thrown at construction, and the discover skill named a
WebSocket transport that does not exist. Serving stale content is worse than leaving it unserved,
because skills are what agents load first.
