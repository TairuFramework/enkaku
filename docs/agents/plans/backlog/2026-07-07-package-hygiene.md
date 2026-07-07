# Package hygiene & conventions sweep

**Origin:** 2026-07-03 repo audit (`completed/2026-07-03-repo-audit.complete.md`), sections 3 and 5. Small mechanical fixes, batchable in one pass.

## Package / workspace hygiene

- `packages/otel` and `packages/react` are missing README.md (the two 0.18 additions; all other 11 packages have one).
- AGENTS.md documents `pnpm run test:unit` but the root `package.json` has no such script — fix one or the other.
- Root `build:types` uses `pnpm -r`, bypassing turbo caching; the `turbo.json` `clean` task matches no package script (packages define `build:clean`).
- `packages/electron` is missing `sideEffects: false` (present in the other 12) and mixes exports-map styles within its own exports.
- Dead `start` scripts in `electron` and `protocol` point at a nonexistent `src/run.ts`.
- `test:types --skipLibCheck` drift: `client`, `electron`, `react`, `server` have it; the other 9 don't. Pick one convention.
- Catalog gaps: `@opentelemetry/api` (otel), `@sozai/stream` (tests/deno duplicates the catalog entry exactly), `@testing-library/dom` (react). `tests/e2e-electron` uses `workspace:*` instead of `workspace:^`.
- `tests/integration/package.json` carries publish-style cruft (`main`/`types`/`exports`/`files` pointing at a nonexistent `lib/`) for a private no-build package.
- Lock is partially deduped: `@types/node` 26.0.1 and 26.1.0 both present in `pnpm-lock.yaml`.

## Conventions (near-perfect otherwise)

- `it` → `test` in 3 test files: `packages/server/test/peer4-handshake.test.ts`, `packages/react/test/context.test.tsx`, `packages/react/test/event.test.tsx`.
- One inline `import('@sozai/log').Logger` type annotation in `packages/server/test/safe-write.test.ts:31` — should be a module-level `import type`.
