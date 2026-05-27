# Surface TypeScript regressions in workspace `pnpm run test`

**Priority:** backlog

## Goal

Today the root `test` script (`turbo run test:unit`) skips per-package `test:types` (the `tsc --noEmit` step). A pre-existing TypeScript error in `packages/client/test/controller-on-done-once.test.ts:107` (around `UnsignedToken<ResultReplyPayload<string>>` assignability) is masked by this.

## Scope

- Add `test:types` to the turbo pipeline so it runs alongside `test:unit` when `pnpm run test` is invoked.
- Or: change root `test` to invoke each package's `test` script (which already runs `test:types && test:unit`) and ensure caching is sound.
- Fix or properly skip the existing `controller-on-done-once.test.ts:107` failure once the gate is in place.

## Out of scope

- Tuning turbo cache for type-check artifacts (already mostly handled).
- CI matrix changes.
