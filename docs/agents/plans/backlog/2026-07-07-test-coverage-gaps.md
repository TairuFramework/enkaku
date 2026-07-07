# Test coverage gaps

**Origin:** 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`), priority 5 (partial). Coverage is otherwise strong — `server` is excellent (33 test files, every src module directly exercised), `client`/`http-serve`/`http-fetch`/`socket` good, all four procedure types covered in integration.

In leverage order:

1. **Protocol schemas** — `packages/protocol/src/schemas/protocol.ts` + `schemas/error.ts`, the procedure-definition schemas gating all downstream validation, have no direct tests. Highest-leverage gap.
2. **React** — one `test.skip` (Suspense path, `packages/react/test/request.test.tsx:201`); `src/hooks.ts` is unexported and untested — dead code or unfinished API, decide.
3. **Electron** — only `allowlist.test.ts` at unit level; `main.ts`/`preload.ts`/`renderer.ts` are covered solely by one Playwright e2e that needs a full Forge build.
4. **Integration suite** — Socket and MessagePort transports are absent from the `tests/integration/` cross-procedure suite (unit-tested only).
5. **Deno** — `tests/deno/` is a fixture with no assertions; Deno compatibility is not actually verified.
