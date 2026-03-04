---
status: complete
date: 2026-03-04
branch: feat/otel
---

# Observability & Tracing

End-to-end OpenTelemetry observability for Enkaku, enabling tracing from key generation through client signing, transport, server auth, handler execution, and error responses.

## Goals

- Trace requests end-to-end across client-server boundary
- Correlate auth failures with signing keys via DID span attributes
- Provide consumer-facing span utilities and a logtape-to-OTel log bridge
- Zero overhead when no OTel SDK is configured (no-op tracers)
- Full OTel ecosystem compatibility (Jaeger, Datadog, Honeycomb, etc.)

## New Package: `@enkaku/otel`

Consumer-facing utilities for observability:

- **`semantic.ts`** — `SpanNames` and `AttributeKeys` constants for all span names and attribute keys
- **`tracers.ts`** — `createTracer()`, `withSpan()`, `getActiveTraceContext()` utilities
- **`context.ts`** — `injectTraceContext()` / `extractTraceContext()` for token header propagation
- **`log-sink.ts`** — `createOTelLogSink()` bridges logtape records to OTel Logs API
- **`logger.ts`** — `traceLogger()` enriches a logger with active span's traceID/spanID

Dependencies: `@opentelemetry/api`, `@opentelemetry/api-logs`, `@enkaku/log`

## Trace Context Propagation

Trace context flows across the client-server boundary via JWT token header fields:

- `tid` — 32-hex-char trace ID (W3C compatible)
- `sid` — 16-hex-char span ID

Client injects these from the active span before signing. Server extracts them to create a child span linked to the client's trace.

## Instrumented Packages

| Package | Instrumentation |
|---------|----------------|
| `@enkaku/token` | Spans around `signToken` and `verifyToken` with DID/algorithm attributes |
| `@enkaku/node-keystore` | Span around `provide()`/`provideAsync()` with DID logging on key generation |
| `@enkaku/browser-keystore` | Same pattern (ES256/P-256 DID derivation) |
| `@enkaku/expo-keystore` | Same pattern (EdDSA) |
| `@enkaku/electron-keystore` | Same pattern (EdDSA) |
| `@enkaku/client` | Spans around `sendEvent`, `request`, `createStream`, `createChannel`; trace context injection into token headers via `context.with()` |
| `@enkaku/server` | Spans around message handling with trace context extraction; DID and auth failure attributes; handler execution within active span context |
| `@enkaku/http-client-transport` | Spans around `sendMessage()` (POST) and `createEventStream()` (SSE) |
| `@enkaku/http-server-transport` | Span around `handleRequest()` |
| `@enkaku/socket-transport` | Span around `connectSocket()` |

## Span Hierarchy

```
enkaku.client.call                    # Client-side root span
├── enkaku.token.sign                 # Token signing (child via active context)
└── (completed on controller result)

enkaku.server.handle                  # Server-side root (child of client via tid/sid)
├── enkaku.token.verify               # Token verification
└── (handler execution within span context)

enkaku.keystore.get_or_create         # Standalone keystore span

enkaku.transport.http.request         # HTTP POST
enkaku.transport.http.sse_connect     # SSE connection
enkaku.transport.http.handle_request  # Server-side HTTP handling
enkaku.transport.socket.connect       # Unix socket connection
```

## Key Design Decisions

- **`@opentelemetry/api` as hard dependency** (not optional peer dep) — the API is a ~50KB no-op facade when no SDK is configured, so the overhead is negligible
- **Instrumented packages use OTel API directly** with string literals rather than importing `@enkaku/otel` constants — keeps core packages decoupled from `@enkaku/otel`, which serves as a consumer-facing utilities package
- **`safeGetDID` helper** in keystores wraps DID computation in try-catch for robustness with invalid key bytes
- **Server uses `otelContext` alias** to avoid naming conflict with HandlerContext's `context` variable
- **Server wraps handler execution in `otelContext.with()`** so child spans inside user handlers are linked to the server handle span

## Integration Test

`tests/integration/otel.test.ts` verifies:
1. Authenticated request traces from client through server with shared traceID
2. Auth failure traces include DID correlation and `auth.allowed=false` attributes

Uses `NodeTracerProvider` (not `BasicTracerProvider`) for async context propagation via `AsyncLocalStorageContextManager`.

## Not Implemented (from original design)

- `@enkaku/log` auto-enrichment — design called for `getEnkakuLogger` to automatically detect active OTel spans; instead, the opt-in `traceLogger()` helper in `@enkaku/otel` was implemented
- Structured auth failure reason constants — server uses raw error messages as `auth.reason` attribute values rather than the enumerated constants from the design (`unsigned_message`, `invalid_signature`, etc.)
- `rpc.method` semantic convention attribute — `rpc.system` is set but `rpc.method` is not used
