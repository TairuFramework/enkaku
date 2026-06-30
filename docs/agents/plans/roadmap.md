# Enkaku Roadmap

As of **0.18 (June 2026)**, Enkaku is the RPC-only layer of the five-repo Yulsi stack.
Identity/auth → `@kokuin`, MLS/group/hub → `@kumiai`, runtime/async/schema/stream →
`@sozai`, shared toolchain → `@kigu`. This roadmap covers Enkaku only (RPC core,
transports, OTel naming, React bindings); relocated workstreams are tracked in their
owning repos (see bottom).

## Recent (2026)

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

Enkaku is in maintenance/hardening — no large feature in flight. Active backlog:

- **Replay protection** — `jti` dedup + `exp` policy on authenticated RPC messages
  (server + protocol). Security hardening. `backlog/replay-protection.md`
- **Docs & release gaps** — website docs lag the current API; typedoc + changesets.
  Tracking only while consumers are stack-internal. `backlog/docs-release-gaps.md`
- **Transport typed constructors** — additive DX helpers so consumers can't drop transport
  type args and fall back to `as unknown as` casts. `backlog/transport-typed-constructors.md`

## Relocated workstreams (tracked in owning repos)

- **`@kokuin`** — identity, tokens, capabilities, keystores, Ledger, post-quantum algos, JWE multi-recipient
- **`@kumiai`** — MLS/group, hub protocol/server/tunnel, broadcast, ts-mls upgrades, capability revocation
- **`@kigu`** — shared toolchain (TS 6/7, catalog, biome/tsconfig, electron-forge)
- **`@sozai`** — runtime, async, event, execution, schema, stream, log
