# Documentation & Release Infrastructure Gaps

**Priority:** backlog, low (consumers are stack-internal: Kubun, Mokei). Tracking only — no implementation planned.
**Origin:** June 2026 audit (`2026-06-10-audit-remediation-design.md`)

## Stale handwritten docs (broken for current API)

Last substantive edit 2025-01; the v0.15→0.16 rename (`public`/`id`/`access` → `identity`/`accessRules`, `randomTokenSigner` → `randomIdentity`/`createIdentity`) is not reflected:

- `website/docs/quick-start.mdx` — uses removed `serve({ public: true })`, fictional `createDirectTransports()`; first copy-paste fails to compile.
- `website/docs/security.mdx` — `randomTokenSigner`, `signer`, `id`, `access` params.
- `website/docs/procedures.mdx` — `response:` field (actual: `result`), syntax error ~line 103, typo "staless".
- `website/docs/examples/*.mdx`, `website/docs/guides/http-transports.mdx` — same stale params.
- Typos: "Enaku" (`introduction.mdx:7`), "interating", "byt" (`api.mdx:43`).
- Prevention idea: CI step compiling doc snippets (twoslash) so API drift fails the build.

## READMEs

- Root `README.md` is 5 lines; package READMEs (client, server, protocol, standalone, transports) are install-only stubs — this is what npm renders.
- Missing: "which packages do I need" decision table (e.g. browser→server over HTTP: client + http-client-transport / server + http-server-transport).

## API reference coverage

- 12 of 39 packages absent from typedoc entryPoints (`website/tsconfig.docs.json`): expo-runtime, group, hd-keystore, hub-client, hub-protocol, hub-server, hub-tunnel, ledger-identity, log, otel, react, runtime. The newest subsystems (hub, MLS groups, OTel, React hooks) have zero published docs.
- `website/docs/api.mdx` directory page omits the same packages.

## Release infrastructure

- No changesets, no CHANGELOGs, no git tags, no GitHub releases, no publish workflow — versions hand-edited. Breaking 0.x changes have no migration notes.
- Adopt when external consumers appear: changesets + tags + a stability statement in the root README.

## DX improvements (ideas, unscheduled)

- `createDirectTransports<Protocol>()` helper — the docs describe this API; only the `DirectTransports` class with hand-written `AnyServerMessageOf`/`AnyClientMessageOf` generics exists.
- Standard Schema (zod/valibot) input for protocol definitions with JSON Schema derivation — biggest ergonomic gap vs tRPC; `@enkaku/schema` already exports `StandardSchemaV1`.
- Client-side default request timeout (currently a lost reply hangs forever without a caller-provided signal).
- Reconnecting transport wrapper (socket + SSE) — design decision, see transport-stability plan's out-of-scope list.
- `@enkaku/generator` naming trap (async-generator utils, reads like codegen) — note in README.
- Error codes EK01+ documentation page once exported as constants (platform-fixes plan).
