# Website post-split rewrite

**Origin:** split out of `next/2026-07-07-stale-docs-cleanup.md` on 2026-07-16. That item
assumed the website needed a cleanup; scoping found a rewrite. The reference-docs half was
completed separately -- see `completed/2026-07-18-stale-docs-cleanup.complete.md`.

The 0.18 split removed 14 of the packages the site documents and renamed every transport. The
site still describes the pre-split world throughout.

## Generated API docs

- `website/tsconfig.docs.json` lists 27 typedoc `entryPoints`; 14 point at packages that no
  longer exist: `browser-keystore`, `capability`, `electron-keystore`, `electron-rpc`,
  `expo-keystore`, `http-client-transport`, `http-server-transport`, `message-transport`,
  `node-keystore`, `node-streams-transport`, `schema`, `socket-transport`, `stream`, `token`,
  plus the `@sozai`-bound utilities `async`, `codec`, `event`, `execution`, `flow`, `generator`,
  `patch`, `result`.
- Missing entirely: `http-fetch`, `http-serve`, `otel`, `react`.
- `website/docs/api/` holds committed typedoc output for the removed packages.
- `website/sidebars.ts` links ~24 dead API pages under `Core`, `RPC`, `Transports`,
  `Key stores`, and `Miscellaneous`.

The repo ships 13 packages: `client`, `electron`, `http-fetch`, `http-serve`, `message`,
`node-streams`, `otel`, `protocol`, `react`, `server`, `socket`, `standalone`, `transport`.

## Prose

Every prose page imports at least one removed package: `communications.mdx`, `validation.mdx`,
`security.mdx`, `api.mdx`, `examples/stateless-http.mdx`, `examples/stateful-http.mdx`,
`guides/http-transports.mdx`, `guides/custom-transports.mdx`, `guides/key-management.mdx`.

`validation.mdx` and `guides/key-management.mdx` are whole pages about domains that left the
repo -- they likely belong to `@sozai` and `@kokuin` respectively rather than being rewritten
here.

## Expect API drift, not just renames

The reference-docs half of this work is the warning. `docs/reference/` looked like it needed a
rename sweep -- the audit counted 20 stale package references in `transport.md`. Verifying every
claim against `packages/*/src` instead found that *renames were the least of it*:

- Every code example was non-compiling. `Client` takes no `protocol` option (it is a type
  parameter); `Server` takes plural `transports` plus a **required** access option, and throws
  at construction without it.
- Invented APIs that never existed: `accessControl`, `ProcedureAccessRecord`, `public: true`,
  `createEventStream`, `events.off()`, `client.stream()`, `SigningIdentity`, `ErrorSchema`.
- Inverted facts: `allowedOrigin` documented as defaulting to `'*'` when it defaults to
  rejecting with `403`; `Writable.toWeb()` described backwards; transferables described as
  transferred when they are copied; automatic SSE reconnection claimed where there is none.

The website's prose is the same vintage and predates the same lifecycle work (`d464198`,
`e90fd13`). Budget for verification against source, not a find-and-replace. The rule that made
the reference work land: a claim that cannot be confirmed against `packages/*/src` gets cut, not
rewritten from memory.

## Open questions

- Do keystore/token/schema pages move to the sibling repos' sites, or does enkaku's site link
  out to them?
- Should `website/docs/api/` stay committed, or be generated at build time and gitignored? It is
  currently committed and stale, which is the worst of both.
