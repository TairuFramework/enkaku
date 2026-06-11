# Export `ErrorCodes` at runtime from published `@enkaku/protocol`

**Date:** 2026-06-11
**Severity:** LOW (ergonomics / API-contract gap)
**Origin:** Kubun sync-server-authentication work (kubun `docs/superpowers/plans/2026-06-11-sync-server-authentication.md`, Q1.2). Surfaced while asserting Enkaku's auth-rejection error code in a kubun test.

## Problem

The canonical error-code map `ErrorCodes` (and its `ACCESS_DENIED = 'EK02'` member) exists in source — `packages/protocol/src/error-codes.ts:7` as a runtime `const`, re-exported by `packages/protocol/src/index.ts:13` (`export * from './error-codes.js'`) and surfaced again via `@enkaku/server` (`packages/server/src/error.ts:3` → `index.ts`). But the **published `@enkaku/protocol@0.16.0`** that downstream consumers install does NOT ship it at runtime:

- `node_modules/@enkaku/protocol/lib/index.js` re-exports only `./schemas/error.js` — there is no `error-codes` module in the published `lib/`.
- `require('@enkaku/protocol').ErrorCodes` → `undefined`.
- Same gap through `@enkaku/server@0.16.0` (its `lib/` carries no `ErrorCodes`).

Source HEAD and the published 0.16.0 carry the **same version number** but different surface — the error-codes export was added in source after 0.16.0 was published (or never built into that release). Consumers pinned to 0.16.0 cannot reach the const.

## Impact

A consumer that does `import { ErrorCodes } from '@enkaku/protocol'` and reads `ErrorCodes.ACCESS_DENIED` at runtime crashes with `Cannot read properties of undefined`. The type-level import resolves (the `.d.ts` may carry it), so the breakage only appears at runtime — the worst failure mode.

Kubun hit this in a test and had to fall back to a hardcoded `const ACCESS_DENIED = 'EK02'`. Hardcoding the literal couples every consumer to the string values and defeats the purpose of a shared code map: a future renumber in enkaku silently desyncs all consumers.

## Fix direction

1. Ensure `error-codes.ts` is included in the package build output (`lib/error-codes.js`) and re-exported from the published entry — i.e. cut a release whose built `lib/` matches the source index surface.
2. Bump the version so consumers can pin to a release that actually ships the runtime const (the gap is invisible at the type layer, so a same-version republish would leave existing installs broken without a signal to re-install).
3. Confirm the re-export chain ships intact through `@enkaku/server` as well, since handler code references codes from there.

## Done when

- A fresh install of the released `@enkaku/protocol` resolves `require('@enkaku/protocol').ErrorCodes.ACCESS_DENIED === 'EK02'` at runtime.
- Same reachable via `@enkaku/server`'s public entry.
- A guard test (or build assertion) fails if `error-codes` is dropped from the built `lib/` again.

## Kubun follow-up (not blocking)

Once a release ships the runtime const, kubun's sync-auth tests and the planned `SyncAccessDeniedError` can import `ErrorCodes` / `ErrorCode` instead of the hardcoded `'EK02'`. Tracked in kubun's sync-server-authentication plan (Phase 3 error-shape decision).
