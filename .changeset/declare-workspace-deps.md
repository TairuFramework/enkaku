---
"@enkaku/client": patch
"@enkaku/electron": patch
"@enkaku/protocol": patch
"@enkaku/react": patch
"@enkaku/standalone": patch
---

Declare every package imported by published code: `@enkaku/protocol` moves to `dependencies` in client, electron, react and standalone, `@enkaku/transport` moves to `dependencies` in protocol, and react and electron gain `react` and `electron` peer dependencies. Strict installs (isolated linker, no hoisting) no longer fail to resolve these from the published declarations.
