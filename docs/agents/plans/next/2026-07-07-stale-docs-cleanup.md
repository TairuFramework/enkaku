# Stale pre-split documentation cleanup

**Origin:** 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`), priority 4. Roughly 8k lines of wrong pre-0.18-split guidance sitting where agents look first.

## `docs/reference/`

- Four domain docs are entirely about packages removed in the 0.18 split: `authentication.md` (1364 lines), `validation.md` (1762), `streaming.md` (1067), `hub-tunnel.md`.
- Five use-case docs install/import removed packages (`@enkaku/token`, `@enkaku/schema`, `@enkaku/stream`, …): `securing-endpoints.md`, `validating-requests.md`, `handling-streaming-data.md`, `real-time-communication.md`, `building-rpc-server.md`.
- `core-rpc.md` and `transport.md` list stale dependency names.
- Action: delete or replace with pointers to `@kokuin/*` / `@sozai/*` / `@kumiai/*` docs.

## `website/`

- `website/docs/api/` — committed typedoc output for ~15 removed packages plus old transport names (`http-client-transport/`, `http-server-transport/`, `message-transport/`, `electron-rpc/`); `website/sidebars.ts` links them; current names (`http-fetch`, `http-serve`, `otel`, `react`) are missing. Regenerate.
- `security.mdx` and `guides/key-management.mdx` still import from `@enkaku/token`.

## `docs/skills/`

- Content (discover / core-rpc / transport skill sources) is post-split current, but nothing references the directory — not `.claude/settings.json`, not AGENTS.md. Either wire it up or document how `/enkaku:discover` is served.

## Known-good (no action)

`docs/agents/architecture.md`, `development.md`, `index.md`, and `roadmap.md` are current and accurate — lifecycle event names verified against source. `backlog/docs-release-gaps.md` was rewritten to post-split scope on 2026-07-07.
