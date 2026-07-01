# Development

Shared build, test, and release workflow lives in the kigu `development` skill,
auto-loaded via the kigu plugin. See it for the pnpm / Turbo / SWC / Biome / Vitest
workflow and the `docs/agents/plans/` lifecycle.

## Repo-specific

RPC framework (protocol, transport, client, server, standalone + transports and React/Electron
bindings). Integration tests in `tests/integration/`; run a package's tests with
`pnpm run test:unit --filter=@enkaku/<pkg>`.
