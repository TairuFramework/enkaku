# Documentation & Release Infrastructure Gaps

**Priority:** backlog, low (consumers are stack-internal). Tracking only — no implementation planned.
**Origin:** June 2026 audit (`completed/2026-06-10-audit-remediation.complete.md`); rewritten 2026-07-07 to post-0.18-split scope (13 RPC-only packages). The bulk pre-split doc staleness (~8k lines in `docs/reference/` + `website/`) is now tracked in `next/2026-07-07-stale-docs-cleanup.md`, not here.

## READMEs

- Root `README.md` is a 4-line stub; package READMEs are install-only stubs — this is what npm renders.
- Missing: "which packages do I need" decision table (e.g. browser→server over HTTP: `client` + `http-fetch` / `server` + `http-serve`).
- (`otel` and `react` missing READMEs entirely — tracked in `backlog/2026-07-07-package-hygiene.md`.)

## Release infrastructure

- Changesets and per-package CHANGELOGs exist since the 0.18 retooling onto `@kigu/dev`. Still missing: git tags, GitHub releases, a stability statement in the root README. Adopt when external consumers appear.
- Prevention idea for doc drift: CI step compiling doc snippets (twoslash) so API changes fail the build.

## DX improvements (ideas, unscheduled)

- `createDirectTransports<Protocol>()` helper — only the `DirectTransports` class with hand-written `AnyServerMessageOf`/`AnyClientMessageOf` generics exists.
- Standard Schema (zod/valibot) input for protocol definitions with JSON Schema derivation — biggest ergonomic gap vs tRPC; `@sozai/schema` exports `StandardSchemaV1`.
- Client-side default request timeout (currently a lost reply hangs forever without a caller-provided signal) — related lifecycle bugs in `next/2026-07-07-client-transport-lifecycle-hardening.md`.
- Reconnecting transport wrapper (socket + SSE).
- Error codes EK01+ documentation page once exported as constants.
