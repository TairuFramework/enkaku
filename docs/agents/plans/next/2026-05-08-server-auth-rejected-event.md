# Unified `authRejected` Event on `@enkaku/server`

**Priority:** next
**Origin:** Driven by `kubun` P1 production-hub-deployment work. `@kubun/hub.createRelay` exposes an `onAuthRejected` observer for ops counters; full coverage requires this event.

## Problem

`Server.events` emits `eventAuthError` only for `event`-typed messages (`packages/server/src/server.ts:472-479`). Auth failures on `request` / `channel` / `stream` / `send` messages send an `EK02` error payload back to the client via `context.send` but emit **no observation event**. Consumers that want to surface "auth rejected" metrics or logs cannot do so uniformly.

Affected emission sites in `server.ts`:

| Site | Lines | Behavior today |
|------|-------|----------------|
| AccessRules denied (request/channel/stream) | 472-479 | sends `EK02` to client, no event |
| AccessRules denied (event) | 472-474 | emits `eventAuthError` + `handlerError` |
| Send-message unsigned in `requireAuth` mode | 555-563 | sends `EK02` to client, no event |
| Send-issuer mismatch | 566-573 | sends `EK02` to client, no event |

`handlerError` does fire on the event path but is too generic for "auth specifically" — it covers EK01 (handler exception), EK06 (size limit), EK07 (encryption violation), etc., as well as EK02.

## Proposal

Add a single `authRejected` event covering every auth-denial path. Payload shape:

```ts
type AuthRejectedEvent = {
  error: HandlerError              // always EK02
  payload: AnyClientPayload<Protocol>
  type: 'event' | 'request' | 'channel' | 'stream' | 'send'
  reason: string                   // error.message
  did?: string                     // signed-token issuer if available
}
```

Emit from each of the four sites above. Keep `eventAuthError` as-is for back-compat in this change (deprecate in a follow-up); event-typed messages would emit both `authRejected` and `eventAuthError` until the deprecation window closes.

## Why a new event vs. extending `handlerError`

`handlerError` already fires on the event-auth path alongside `eventAuthError`. Filtering by `error.code === 'EK02'` works mechanically but couples consumers to error-code internals. A dedicated event keeps the public hook stable across future code reshuffles.

## Acceptance criteria

- `Server.events` typed surface includes `authRejected` with the payload shape above.
- All four denial sites emit `authRejected` before `context.send` (or alongside `eventAuthError`/`handlerError` on the event path).
- `eventAuthError` still emits for event-typed denials (back-compat).
- New unit test in `packages/server/test/` exercising each of the four sites and asserting `authRejected` fired with correct `type`.
- No change to client-visible error payloads; the event is observation-only.

## Touch points

- `packages/server/src/types.ts` — add the event to `ServerEmitter`.
- `packages/server/src/server.ts` — four emission sites listed above.
- `packages/server/test/auth.test.ts` (or similar) — add coverage.

## Downstream

`@kubun/hub.createRelay` (already shipped in kubun's P1) currently wires `onAuthRejected` only from `eventAuthError` and undercounts on request-typed hub procedures (`hub/send`, `hub/fetch`, `hub/ack`). Once this lands, `@kubun/hub` switches its subscription to `authRejected` and full coverage applies. Tracked in kubun's plan log as a known gap.

## Out of scope

- Deprecating / removing `eventAuthError`. Separate follow-up after consumers migrate.
- Surfacing reason classification beyond `error.message`. The string is enough for counters; a structured taxonomy is a bigger design.
