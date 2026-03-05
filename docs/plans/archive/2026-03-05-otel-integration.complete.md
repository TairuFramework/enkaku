---
status: complete
branch: feat/otel-integration
pr: https://github.com/TairuFramework/enkaku/pull/12
---

# OpenTelemetry Integration

## Goal

Fully integrate `@enkaku/otel` across the Enkaku framework so all consuming packages import only from `@enkaku/otel`, never directly from `@opentelemetry/api`. Simplifies debugging end-to-end RPC flows spanning multiple clients and servers.

## Approach

Full encapsulation via thin wrapper. The `@enkaku/otel` package re-exports needed OpenTelemetry types and provides higher-level helpers that reduce span management boilerplate.

## What Changed

### @enkaku/otel Expansion

- **New helpers**: `withSyncSpan` (sync span lifecycle), `getActiveSpan`, `withActiveContext`, `setSpanOnContext`
- **Enhanced `withSpan`**: Now accepts optional `parentContext` parameter for server-side parent span propagation
- **Re-exported types**: `Context`, `Span`, `SpanOptions`, `SpanStatusCode`, `Tracer`, `TraceFlags` from `@opentelemetry/api`
- **New semantic constants**: `TRANSPORT_SOCKET_CONNECT`, `TRANSPORT_SESSION_ID`, `HTTP_METHOD`, `HTTP_STATUS_CODE`, `NET_PEER_NAME`
- **W3C traceparent**: `formatTraceparent` / `parseTraceparent` for HTTP transport interoperability

### Package Refactoring (10 packages)

All consuming packages had `@opentelemetry/api` removed from dependencies and replaced with `@enkaku/otel` imports:

- **token**: `verifyToken` and `signToken` use `withSpan`
- **keystores** (node, browser, expo, electron): `withSyncSpan` for sync operations, `withSpan` for async
- **socket-transport**: Fixed span name from `TRANSPORT_WS_CONNECT` to `TRANSPORT_SOCKET_CONNECT`
- **http-client-transport**: `withSpan` for `createEventStream`, manual spans for `sendMessage` (custom error status), traceparent injection on outgoing requests
- **http-server-transport**: Manual spans for `handleRequest` (custom error status), traceparent extraction from incoming requests
- **server**: Imported `extractTraceContext`, uses `setSpanOnContext` and `withActiveContext` helpers
- **client**: `withSpan` for `sendEvent`, manual spans for `request`/`createStream`/`createChannel` (promise-based span ending), extracted `#endSpanOnResult` helper

### Tracer Injection

Client and Server accept optional `tracer` in constructor options (same pattern as `logger`). When provided, all spans use the custom tracer. When omitted, falls back to `createTracer('client')` / `createTracer('server')`.

### W3C Traceparent (HTTP Only)

HTTP transports inject/extract `traceparent` headers alongside existing `tid`/`sid` propagation. When both are present, `tid`/`sid` takes precedence. Enables interoperability with reverse proxies and non-Enkaku services.

### New Instrumentation

- **Stream/channel lifecycle span events**: Client and server both emit span events (`stream.message.received`, `stream.message.sent`, `channel.message.received`, `channel.message.sent`) for each message, with direction attributes. Server handlers capture the active span during sync setup for use in async stream callbacks.
- **SERVER_HANDLER span**: Child span of `SERVER_HANDLE` wrapping just handler execution, distinct from the full request processing which includes auth and encryption checks.
- **Schema validation events**: `enkaku.validation` span events with success/failure status. Validation failures create a short-lived span with error details.
- **Systematic error enrichment**: All server error paths (auth rejection, encryption violation, handler errors) set `enkaku.error.code` and `enkaku.error.message` attributes consistently.
- **Span links**: `SERVER_HANDLE` span links back to the client's `CLIENT_CALL` span via extracted `tid`/`sid` for explicit cross-service correlation in trace viewers.

## Not Implemented (Future Work)

- Tracer injection for transports and keystores (only client/server have it)
