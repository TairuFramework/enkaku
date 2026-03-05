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

## Not Implemented (Future Work)

- Stream/channel lifecycle spans (parent span per stream, events for messages)
- `SERVER_HANDLER` span wrapping handler execution (distinct from `SERVER_HANDLE`)
- Schema validation span events
- Systematic error enrichment with `enkaku.error.code` / `enkaku.error.message`
- Span links from server back to client span
- Tracer injection for transports and keystores (only client/server have it)
