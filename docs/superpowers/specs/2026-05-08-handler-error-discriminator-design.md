# Unified `handlerError` Discriminator on `@enkaku/server`

**Date:** 2026-05-08
**Origin:** Driven by `kubun` P1 production-hub-deployment work. `@kubun/hub.createRelay` exposes an `onAuthRejected` observer for ops counters; full coverage requires every auth-denial path to surface a uniform observation event.

## Background

`Server.events` currently emits two events for handler failures:

- `handlerError` — fires for handler exceptions (EK01), message size violations (EK06), and event-path auth denials (EK02). Payload: `{ error, payload }`. Consumers cannot tell *what kind of failure* without inspecting `error.code`.
- `eventAuthError` — fires only on event-path auth denials (`packages/server/src/server.ts:472-474`). Same payload shape as `handlerError`.

Auth denials on `request`, `channel`, `stream`, and `send` messages call `context.send` to return an EK02 payload to the client but emit **no observation event**. Encryption-policy violations are also unobserved on the event surface (`handleEncryptionViolation`).

This forces consumers like `@kubun/hub` to subscribe to `eventAuthError` for partial coverage and miss request/channel/stream/send denials entirely.

## Decision

Unify on a single `handlerError` event for every server-side handler failure, extended with two discriminator fields:

```ts
export type HandlerErrorCategory = 'auth' | 'limit' | 'encryption' | 'handler'
export type HandlerErrorMessageType = 'event' | 'request' | 'channel' | 'stream' | 'send'

handlerError: {
  error: HandlerError<string>
  payload: Record<string, unknown>
  category: HandlerErrorCategory
  messageType: HandlerErrorMessageType
}
```

Remove `eventAuthError` from `ServerEvents`. Consumers migrate to `handlerError` and filter by `category` and/or `messageType`.

### Why a discriminator vs. a new dedicated event

A new `authRejected` event would couple the API surface to a single failure category. A discriminator scales: future categories (rate-limit, quota, etc.) extend the union without new event names. Filtering on `error.code` alone (status quo with broader emission) was rejected because it couples consumers to error-code internals.

### Why include `messageType`

`@kubun/hub` wants per-procedure-kind counters. Without `messageType`, consumers must re-derive it from `payload.typ`, which is payload-shape sniffing. Adding the field is cheap and removes that duplication.

## Type surface (`packages/server/src/types.ts`)

```ts
export type HandlerErrorCategory = 'auth' | 'limit' | 'encryption' | 'handler'
export type HandlerErrorMessageType = 'event' | 'request' | 'channel' | 'stream' | 'send'

export type ServerEvents = {
  // existing entries unchanged except handlerError below
  handlerError: {
    error: HandlerError<string>
    payload: Record<string, unknown>
    category: HandlerErrorCategory
    messageType: HandlerErrorMessageType
  }
  // eventAuthError REMOVED
}
```

`messageType` excludes `'abort'` because aborts do not fire `handlerError`.

The `category` and `messageType` fields are **required**, not optional. Optional fields would defeat the discriminator's purpose as a stable, explicit consumer hook.

## Emission sites (`packages/server/src/server.ts`)

| Site | Lines (approx.) | Today | After |
|------|------|-------|-------|
| AccessRules denied (event) | 472-474 | `eventAuthError` + `handlerError` | `handlerError` { category:'auth', messageType:'event' } |
| AccessRules denied (request/channel/stream) | 475-479 | sends EK02, no event | adds `handlerError` { category:'auth', messageType: payload.typ } |
| Send-message unsigned in `requireAuth` mode | 555-563 | sends EK02, no event | adds `handlerError` { category:'auth', messageType:'send' } |
| Send-issuer mismatch | 564-574 | sends EK02, no event | adds `handlerError` { category:'auth', messageType:'send' } |
| Message exceeds size limit | 506-517 | `handlerError` without category | `handlerError` { category:'limit', messageType: payload.typ } |
| Encryption violation | `handleEncryptionViolation` (483-491 + helper) | audit during impl | `handlerError` { category:'encryption', messageType: payload.typ } |
| Handler exception (EK01 and equivalents) | existing emission sites | `handlerError` without category | `handlerError` { category:'handler', messageType: payload.typ } |

Implementation must audit every existing `handlerError` emit and assign `category` correctly. `context.send` (client-visible EK02 payload) behavior is unchanged on every site — the change is observation-only.

## Migration

- `eventAuthError` removal triggers a TypeScript compile error for any subscriber. Forces migration.
- `@kubun/hub.createRelay.onAuthRejected` switches its subscription from `eventAuthError` to `handlerError` filtered on `category === 'auth'`. This closes the undercount gap (request/channel/stream/send paths now reported).
- No client-wire-format change. No protocol version bump.

## Acceptance criteria

- `ServerEvents.handlerError` payload includes required `category` and `messageType` fields with the union types above.
- `ServerEvents.eventAuthError` removed.
- All four auth-denial sites emit `handlerError` with `category:'auth'` and the correct `messageType`.
- All existing `handlerError` emissions continue to fire with the appropriate `category` (`'limit'`, `'encryption'`, `'handler'`) assigned.
- Per-site test coverage updated:
  - `packages/server/test/event-auth.test.ts` — auth + event
  - `packages/server/test/access-control.test.ts` — auth + request/channel/stream
  - `packages/server/test/channel-send-auth.test.ts` — auth + send (unsigned and issuer mismatch)
  - `packages/server/test/buffer-limits.test.ts` and/or `limits.test.ts` — limit + correct messageType
  - `packages/server/test/encryption-policy.test.ts` — encryption + correct messageType
  - Existing handler-exception tests assert `category:'handler'` if they already check `handlerError`
- Client-visible EK02 / size-limit / encryption-violation error payloads unchanged.

## Touch points

- `packages/server/src/types.ts` — type changes
- `packages/server/src/server.ts` — emission sites (4 new auth sites + audit existing)
- `packages/server/test/*.test.ts` — coverage as listed above

## Out of scope

- Reason classification beyond `error.message`. The string is sufficient for counters; structured taxonomy is a separate design.
- Client-side observation events.
- Renaming `handlerError` itself.
