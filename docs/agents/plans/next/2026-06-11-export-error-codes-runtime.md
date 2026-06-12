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

## Related gap: `HandlerError` class not exported — consumers can't emit wire-distinguishable error codes

Same theme, found in the same kubun work (Phase 2 error-shape design).

`executeHandler` (`packages/server/src/utils.ts:67`) wraps every thrown handler error: `HandlerError.from(cause, { code: ErrorCodes.HANDLER_ERROR, message: 'Handler execution failed' })`. In `HandlerError.from` (`packages/server/src/error.ts:19-28`), a plain `Error` is rebuilt as `new HandlerError({ message: cause.message, ...params, cause })` — because `...params` spreads AFTER `message`, the consumer's `message` AND any `code`-like field are overwritten by `HANDLER_ERROR` / `'Handler execution failed'`. Only a `cause instanceof HandlerError` is returned unchanged (code + message preserved).

But the `HandlerError` **class** is not exported from `@enkaku/server`'s public entry (`packages/server/src/index.ts` exports the `HandlerErrorCategory` / `HandlerErrorMessageType` types only, not the class or `HandlerErrorParams`). So a downstream handler cannot construct or subclass `HandlerError` to throw an error whose `code`/`message` survive to the client. Every thrown domain error collapses to the generic `HANDLER_ERROR` / `'Handler execution failed'` envelope on the wire.

**Impact (kubun):** kubun's sync handlers want to deny forged/unauthorized requests with a distinct, client-observable code (to tell "you didn't sign" — EK02 — from "you signed but lack scope access"). They cannot, because they can't emit a `HandlerError` subclass. Workaround: kubun throws a plain `SyncAccessDeniedError` (code `KB08`) usable server-side only (typed catch, logging, tests); the wire shows the generic envelope. This matches how `@kubun/plugin-rpc` already sidesteps it — it catches its `WriteAccessDeniedError` inside the handler and hand-builds a GraphQL result rather than throwing through enkaku.

**Fix direction:** export `HandlerError` (class) + `HandlerErrorParams` from `@enkaku/server`'s public entry, so consumers can `throw new HandlerError({ code, message })` (or subclass it) and have `executeHandler`'s `from()` pass it through untouched. Pairs naturally with shipping `ErrorCodes` at runtime (above) — together they let consumers emit typed, wire-distinguishable errors.

**Done when:** `import { HandlerError } from '@enkaku/server'` resolves at runtime; a handler that throws a `HandlerError` subclass with a custom code delivers that code (not `HANDLER_ERROR`) to the client, with a test.

## Kubun follow-up (not blocking)

Once a release ships the runtime const AND exports `HandlerError`, kubun's `SyncAccessDeniedError` can extend `HandlerError<'KB08'>` (wire-preserving) and its tests can import `ErrorCodes` / `ErrorCode` instead of the hardcoded `'EK02'`. Tracked in kubun's sync-server-authentication plan (Phase 2/3 error-shape decisions).
