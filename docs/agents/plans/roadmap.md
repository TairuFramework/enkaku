# Enkaku Roadmap

As of **0.18 (June 2026)**, Enkaku is the RPC-only layer of the five-repo Yulsi stack.
Identity/auth → `@kokuin`, MLS/group/hub → `@kumiai`, runtime/async/schema/stream →
`@sozai`, shared toolchain → `@kigu`. This roadmap covers Enkaku only (RPC core,
transports, OTel naming, React bindings); relocated workstreams are tracked in their
owning repos (see bottom).

## Recent (2026)

- **Stale pre-split docs cleanup** — deleted ~8.4k orphaned lines, verified the two surviving
  reference docs claim-by-claim against source (134 claims, 9 wrong), and shipped the discovery
  skills as an in-repo plugin so `/enkaku:discover` resolves.
  `completed/2026-07-18-stale-docs-cleanup.complete.md`
- **0.18 stack refactor / repo split** — trimmed Enkaku to 13 RPC-only packages, retooled
  onto `@kigu/dev`, published RPC at 0.18.0. `completed/2026-06-30-stack-refactoring`
- **Transport framing/size limits** — bounded-memory knobs across all transports + the
  JSON-lines framer (PR #36). `archive/2026-06`
- **Channel `send` `prc` fix** — closed silent-drop of channel sends on validating servers.
- **OTel W3C inbound** — server-side trace-context build + baggage activation (PR #42).
- **Pre-split, now relocated** — group-messaging primitives, MLS auth/rejoin, generator/
  stream fixes shipped in Enkaku earlier in 2026, then moved to `@kumiai`/`@sozai` in the split.
- **Earlier 2026** — SSE/transport modernization, lifecycle events + `handlerError`
  discriminator, access-control refactor. (Auth/MLS/identity milestones now live in
  `@kokuin`/`@kumiai` history.)

## Current Focus

Enkaku is in maintenance/hardening — no large feature in flight. The 2026-07-03 repo audit
(`completed/2026-07-03-repo-audit.complete.md`) set the current priorities.

Next (immediate):

- **Replay protection hardening** — the 0.18.x replay feature (shipped
  `completed/2026-07-01-replay-protection`) doesn't meet its threat model: no client
  `jti`/`iat` means deterministic-signature dedup keys and inert staleness rejection.
  `next/2026-07-07-replay-protection-hardening.md`
- **Client/transport lifecycle hardening** — client read-loop death on malformed messages,
  graceful-close hangs, socket write-after-close crash, SSE session timeout on live streams,
  plus medium-severity backpressure/rid-reuse/race fixes.
  `next/2026-07-07-client-transport-lifecycle-hardening.md`

Backlog:

- **Website post-split rewrite** — typedoc lists 14 packages that no longer exist, sidebars
  link ~24 dead API pages, and every prose page imports a removed package. Expect API drift,
  not just renames. `backlog/2026-07-16-website-post-split-rewrite.md`
- **Test coverage gaps** — protocol schema tests (highest leverage), electron/react/deno
  gaps, socket + MessagePort integration coverage. `backlog/2026-07-07-test-coverage-gaps.md`
- **Package hygiene & conventions sweep** — READMEs, script/catalog drift, `it` → `test`.
  `backlog/2026-07-07-package-hygiene.md`
- **Docs & release gaps** — README quality, release tags, DX ideas. Tracking only while
  consumers are stack-internal. `backlog/docs-release-gaps.md`
- **Sibling-repo skill plugins** — `kokuin` and `sozai` carry the same unwired `docs/skills/`
  enkaku just migrated; verify content against source before serving it.
  `backlog/2026-07-18-sibling-repo-skill-plugins.md`
- **Transport typed constructors** — additive DX helpers so consumers can't drop transport
  type args and fall back to `as unknown as` casts. `backlog/transport-typed-constructors.md`

## Relocated workstreams (tracked in owning repos)

- **`@kokuin`** — identity, tokens, capabilities, keystores, Ledger, post-quantum algos, JWE multi-recipient
- **`@kumiai`** — MLS/group, hub protocol/server/tunnel, broadcast, ts-mls upgrades, capability revocation
- **`@kigu`** — shared toolchain (TS 6/7, catalog, biome/tsconfig, electron-forge)
- **`@sozai`** — runtime, async, event, execution, schema, stream, log
