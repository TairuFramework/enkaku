# Handler Error Discriminator on `@enkaku/server`

**Status:** complete
**Date:** 2026-05-08
**Branch:** feat/auth-rejected-event

## Goal

Surface a uniform observation event for every handler-failure path on `@enkaku/server` so that consumers (initially `@kubun/hub.createRelay.onAuthRejected`) can count and classify failures across all message types. Closes the prior gap where `request`/`channel`/`stream`/`send` auth denials and non-event encryption violations emitted nothing observable while only event-typed denials had a dedicated `eventAuthError` event.

## Key Design Decisions

- **Single discriminated event over a new dedicated one.** Initial proposal was a new `authRejected` event. Pivoted to extending the existing `handlerError` payload with two required discriminator fields: `category: 'auth' | 'limit' | 'encryption' | 'handler'` and `messageType: 'event' | 'request' | 'channel' | 'stream' | 'send'`. Reason: a discriminator scales (future categories add to the union without new event names), avoids consumer coupling to error-code internals (`error.code === 'EK02'`), and keeps the public event surface tight.
- **`messageType` included alongside `category`.** kubun and similar consumers want per-procedure-kind counters. Without `messageType`, consumers re-derive it from `payload.typ` (payload-shape sniffing). The cost is one extra string field per emission.
- **`eventAuthError` removed outright, no deprecation.** Pre-1.0 status, single known consumer. Forced TypeScript compile error on subscribers cleanly drives migration.
- **`handleEncryptionViolation` emits unconditionally for every `messageType`.** Previously emitted only on the event path. Closes a parallel undercount gap on the encryption side.
- **Discriminator fields are required, not optional.** Optional fields would have defeated the purpose as a stable consumer hook.
- **Test waits use `events.once('handlerError')` (deterministic Promise) over `setTimeout` polling.** Tightens flakiness surface for the new integration tests.

## What Was Built

- `packages/server/src/types.ts` — `HandlerErrorCategory` and `HandlerErrorMessageType` union types added; `handlerError` payload extended with required `category` + `messageType`; `eventAuthError` removed.
- `packages/server/src/index.ts` — discriminator types exported.
- `packages/server/src/server.ts` — every existing `handlerError` emit annotated; four new emits added at the previously-silent auth-denial sites (request/channel/stream access-rule deny, send-unsigned, send-issuer-mismatch); `handleEncryptionViolation` now always emits.
- `packages/server/src/utils.ts` — `emitHandlerError` helper centralizes the emit shape and the `messageType: payload.typ as HandlerErrorMessageType` cast across all 10 call sites.
- `packages/server/src/handlers/event.ts` — uses the helper for the EK01 event-handler-exception emission.
- `packages/server/test/access-control-deny.test.ts` (new) — three integration tests covering request/channel/stream auth denials via `serve()` + `accessRules`. The pre-existing `access-control*.test.ts` files only unit-test `checkClientToken`; this new file exercises the server pipeline end-to-end.
- Per-site test extensions on `event-auth.test.ts`, `channel-send-auth.test.ts`, `encryption-policy.test.ts` (plus a new request-path EK07 case), `buffer-limits.test.ts`, `event-handler.test.ts`, `utils.test.ts`, `stream-crash.test.ts` — all `handlerError` assertions extended with literal `category` + `messageType` checks. `limits.test.ts` not modified (no `handlerError` assertions present — pure unit tests of `createResourceLimiter`).
- `docs/agents/architecture.md` — `Server.events` listing updated to reflect the discriminator surface.

## Deviations from Plan

- **Plan Task 4 rewritten mid-execution.** Originally targeted `access-control.test.ts` for new assertions; that file is unit tests of `checkClientToken`, not integration via `serve()`. New file `access-control-deny.test.ts` created instead.
- **`stream-crash.test.ts` second block uses `messageType: 'channel'`** rather than the plan's `'stream'`. The test sends a `typ: 'channel'` token; production emits `messageType: payload.typ`. Test correctly verifies observed behavior.
- **`limits.test.ts` not modified.** No `handlerError` assertions to extend — file is unit tests of the resource limiter only.

## Downstream

`@kubun/hub.createRelay.onAuthRejected` migrates from subscribing to `eventAuthError` (event-path only) to `handlerError` filtered on `category === 'auth'`, gaining full coverage across all four denial sites. Tracked in kubun's plan log.

## Out of Scope

- Reason classification beyond `error.message` (kept as a string; structured taxonomy is a separate design).
- Client-side observation events.
- Renaming `handlerError` itself.
- Auto-generated docs at `website/docs/api/server/index.md` will refresh on the next typedoc build (no top-level workspace docs script).
