# OTel Per-Repo Span Namespacing — Design

**Date:** 2026-06-29
**Status:** Approved (design)
**Repos:** `sozai`, `kokuin`, `enkaku` (one coordinated change)

## Problem

After the repo split, all OpenTelemetry instrumentation moved into the shared base
package `@sozai/otel`. That package hardcodes the `sozai.` prefix in three places, so
spans and attributes emitted by `@enkaku/*` and `@kokuin/*` are all mislabeled `sozai.*`:

| Spot | File | Issue |
|------|------|-------|
| Span names | `sozai/packages/otel/src/semantic.ts` | `CLIENT_CALL: 'sozai.client.call'`, `SERVER_HANDLE`, `TOKEN_SIGN`, `KEYSTORE_*`, `TRANSPORT_*` |
| Tracer scope | `sozai/packages/otel/src/tracers.ts` | `getTracer('sozai.' + name)` — instrumentation scope mislabeled |
| Attribute keys | `sozai/packages/otel/src/semantic.ts` | `AUTH_DID: 'sozai.auth.did'`, `KEYSTORE_*`, `TRANSPORT_*`, `STREAM/CHANNEL/MESSAGE_*`, `VALIDATION_*`, `ERROR_*` |

Symptom: `enkaku/tests/integration/otel.test.ts` fails — observed span names
`['sozai.token.sign','sozai.token.verify','sozai.client.call','sozai.server.handler','sozai.server.handle']`,
but the test asserts `enkaku.client.call` / `enkaku.server.handle` / `enkaku.auth.did`.

## Ownership (zero overlap between repos)

- **enkaku** (`client server http-fetch http-serve socket`) emits:
  `CLIENT_CALL/RESPONSE`, `SERVER_HANDLE/HANDLER/ACCESS_CONTROL`, all `TRANSPORT_*`.
  Domain attrs: `AUTH_DID/ALLOWED/REASON`, `TRANSPORT_TYPE/SESSION_ID`,
  `MESSAGE_DIRECTION`, `STREAM/CHANNEL_MESSAGE_INDEX`, `VALIDATION_*`, `ERROR_*`.
  Also consumes std attrs `RPC_*`, `HTTP_*`, `NET_*`.
- **kokuin** (`token deterministic browser node electron expo ledger-device`) emits:
  `TOKEN_SIGN/VERIFY`, `KEYSTORE_GET_OR_CREATE`.
  Domain attrs: `AUTH_DID/ALGORITHM`, `KEYSTORE_KEY_CREATED/STORE_TYPE`.
- **kumiai**: no otel usage today.
- **sozai/otel**: defines all names, emits none.

Layer order: **sozai → kokuin → enkaku** (enkaku deps `@kokuin/token` + `@kokuin/capability`;
kokuin deps `@sozai/otel`; no cycles). `@sozai/otel` is the bottom layer, so it must not
reference enkaku/kokuin domain names — names live in the owning repo.

Note `auth.did` is emitted by both enkaku (server access-control span) and kokuin
(token span). These are **not shared**: each repo defines its own prefixed key
(`enkaku.auth.did` vs `kokuin.auth.did`) on its own spans. Same suffix, different owner,
no cross-dependency.

## Architecture decisions

| # | Decision |
|---|----------|
| Spec scope | One spec, all 3 repos, one coordinated change. |
| Std attrs | OTel-standard vendor-neutral keys (`rpc.*`, `http.*`, `net.*`) stay in `@sozai/otel`. |
| Tracer prefix | `@sozai/otel` exports `createTracerFactory(prefix)`; each repo's otel pkg builds its scoped `createTracer`. |
| Import surface | Mixed: infra functions imported from `@sozai/otel`; names + `createTracer` from the local repo otel pkg. |
| Attr/name exports | Separate named exports (explicit provenance): `EnkakuAttributeKeys` / `KokuinAttributeKeys`, `EnkakuSpanNames` / `KokuinSpanNames`. `@sozai/otel` keeps `AttributeKeys` (std only). |
| Test split | enkaku integration test asserts its own `enkaku.*` spans **plus** `kokuin.token.sign` (cross-pkg trace propagation). kokuin gets its own token-only otel test. |
| Cross-repo link | Published npm versions; rollout sozai → kokuin → enkaku. |

Rejected alternatives:
- Centralized prefixed names in `@sozai/otel` — layering violation (bottom layer would
  reference upstream domains).
- Configurable-prefix-only, no new packages — every call site repeats the prefix string.

## Component 1 — `@sozai/otel` (refactor)

Pure instrumentation infra. Owns no domain names.

**Keep:** `withSpan`, `withSyncSpan`, `getActiveSpan`, `getActiveBaggage`,
`getActiveTraceContext`, `withActiveBaggage`, context/baggage/traceparent/tracestate
helpers, log-sink, logger, `ZERO_TRACE_ID`, OTel type re-exports.

**`tracers.ts`:** replace hardcoded-prefix `createTracer` with a factory.

```ts
export function createTracerFactory(prefix: string) {
  return (name: string): Tracer => trace.getTracer(`${prefix}.${name}`, VERSION)
}
```

Do not export a default `createTracer` (sozai emits no spans of its own).

**`semantic.ts`:** remove all `SpanNames` (entire export deleted) and all
vendor-prefixed attrs. Keep only OTel-standard `AttributeKeys`:

```
RPC_PROCEDURE  RPC_REQUEST_ID  RPC_TYPE  RPC_SYSTEM
HTTP_METHOD    HTTP_STATUS_CODE
NET_PEER_NAME
```

`index.ts`: drop `SpanNames` from the re-export; add `createTracerFactory`; remove the
old `createTracer`.

**Breaking change** → changeset (minor/major per repo convention). Published before any
consumer.

## Component 2 — `@enkaku/otel` (new)

Location `enkaku/packages/otel/`. Mirrors existing enkaku package layout (swc + tsc
build, same tsconfig/biome). Deps: `@sozai/otel` (`^0.1.x` published), `@opentelemetry/api`
(for the `Tracer` type), version `0.1.0`.

```ts
import { createTracerFactory } from '@sozai/otel'
export const createTracer = createTracerFactory('enkaku')

export const EnkakuSpanNames = {
  CLIENT_CALL: 'enkaku.client.call',
  CLIENT_RESPONSE: 'enkaku.client.response',
  SERVER_HANDLE: 'enkaku.server.handle',
  SERVER_ACCESS_CONTROL: 'enkaku.server.access_control',
  SERVER_HANDLER: 'enkaku.server.handler',
  TRANSPORT_WRITE: 'enkaku.transport.write',
  TRANSPORT_HTTP_REQUEST: 'enkaku.transport.http.request',
  TRANSPORT_HTTP_SSE_CONNECT: 'enkaku.transport.http.sse_connect',
  TRANSPORT_WS_CONNECT: 'enkaku.transport.ws.connect',
  TRANSPORT_WS_MESSAGE: 'enkaku.transport.ws.message',
  TRANSPORT_SOCKET_CONNECT: 'enkaku.transport.socket.connect',
} as const

export const EnkakuAttributeKeys = {
  AUTH_DID: 'enkaku.auth.did',
  AUTH_ALLOWED: 'enkaku.auth.allowed',
  AUTH_REASON: 'enkaku.auth.reason',
  TRANSPORT_TYPE: 'enkaku.transport.type',
  TRANSPORT_SESSION_ID: 'enkaku.transport.session_id',
  MESSAGE_DIRECTION: 'enkaku.message.direction',
  STREAM_MESSAGE_INDEX: 'enkaku.stream.message_index',
  CHANNEL_MESSAGE_INDEX: 'enkaku.channel.message_index',
  VALIDATION_SUCCESS: 'enkaku.validation.success',
  VALIDATION_ERROR: 'enkaku.validation.error',
  ERROR_CODE: 'enkaku.error.code',
  ERROR_MESSAGE: 'enkaku.error.message',
} as const
```

**Consumer rewiring** (`client server http-fetch http-serve socket`):
- `createTracer` import: `@sozai/otel` → `@enkaku/otel`.
- `SpanNames.*` → `EnkakuSpanNames.*` (from `@enkaku/otel`).
- `AttributeKeys.AUTH_*/TRANSPORT_*/MESSAGE_*/STREAM_*/CHANNEL_*/VALIDATION_*/ERROR_*`
  → `EnkakuAttributeKeys.*` (from `@enkaku/otel`).
- Keep `AttributeKeys.RPC_*/HTTP_*/NET_*` from `@sozai/otel`.
- Keep `withSpan`/`withSyncSpan`/`getActiveSpan`/types from `@sozai/otel`.
- Add `@enkaku/otel` dependency; keep `@sozai/otel` dependency.

## Component 3 — `@kokuin/otel` (new)

Location `kokuin/packages/otel/`. Mirrors kokuin package layout. Deps: `@sozai/otel`,
`@opentelemetry/api`, version `0.1.0`.

```ts
import { createTracerFactory } from '@sozai/otel'
export const createTracer = createTracerFactory('kokuin')

export const KokuinSpanNames = {
  TOKEN_SIGN: 'kokuin.token.sign',
  TOKEN_VERIFY: 'kokuin.token.verify',
  KEYSTORE_GET_OR_CREATE: 'kokuin.keystore.get_or_create',
} as const

export const KokuinAttributeKeys = {
  AUTH_DID: 'kokuin.auth.did',
  AUTH_ALGORITHM: 'kokuin.auth.algorithm',
  KEYSTORE_KEY_CREATED: 'kokuin.keystore.key_created',
  KEYSTORE_STORE_TYPE: 'kokuin.keystore.store_type',
} as const
```

**Consumer rewiring** (`token deterministic browser node electron expo ledger-device`):
- `createTracer` import: `@sozai/otel` → `@kokuin/otel`.
- `SpanNames.*` → `KokuinSpanNames.*`.
- `AttributeKeys.AUTH_*/KEYSTORE_*` → `KokuinAttributeKeys.*`.
- Keep `withSpan`/`withSyncSpan`/types from `@sozai/otel`.
- Add `@kokuin/otel` dependency; keep `@sozai/otel` dependency.

## Component 4 — Tests

**enkaku `tests/integration/otel.test.ts`** (e2e, uses `@kokuin/token`):
- Keep `enkaku.client.call`, `enkaku.server.handle` assertions and the client↔server
  trace-ID propagation check.
- Change the token assertion `enkaku.token.sign` → `kokuin.token.sign` (proves the
  kokuin signing span joins the same trace).
- Keep `enkaku.auth.did` / `enkaku.auth.allowed` attribute assertions on the server span
  (now actually emitted).

**kokuin new test** `kokuin/packages/token/test/otel.test.ts` (token-only this pass):
- Exercise sign/verify in isolation; assert span names `kokuin.token.sign` /
  `kokuin.token.verify`.
- Assert attrs `kokuin.auth.did` / `kokuin.auth.algorithm` on the token span.
- Keystore otel coverage deferred (keystores exercised elsewhere).

## Rollout (published npm, ordered)

1. **sozai** — refactor `@sozai/otel`; changeset; build/test/lint green; publish.
2. **kokuin** — add `@kokuin/otel`; rewire 7 consumers; bump `@sozai/otel` dep to the new
   published range; add token otel test; changeset; build/test/lint green; publish
   `@kokuin/otel` + bumped consumers.
3. **enkaku** — add `@enkaku/otel`; rewire 5 consumers; bump `@sozai/otel` + `@kokuin/*`
   deps to published ranges; update integration test; changeset; build/test/lint green.

**Gate each repo** (independently green): `pnpm install` → `pnpm run build` →
`pnpm run test` → lint (`rtk proxy pnpm run lint` in enkaku).

**Guardrails (AGENTS.md):** `type` not `interface`; `ID`/`HTTP`/`JWT` casing; `Array<T>`;
no `any`; `pnpm` only; don't edit generated files.

## Success criteria

- enkaku spans named `enkaku.*`, kokuin spans `kokuin.*`, no `sozai.*` domain spans.
- Tracer instrumentation scopes correspondingly prefixed.
- `enkaku/tests/integration/otel.test.ts` passes (including `kokuin.token.sign` in-trace).
- New kokuin token otel test passes.
- All three repos build/test/lint green; no dangling `@sozai/otel` `SpanNames` imports.
