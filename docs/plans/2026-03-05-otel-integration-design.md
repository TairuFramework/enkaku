# OpenTelemetry Integration Design

## Goal

Fully integrate `@enkaku/otel` across the Enkaku framework to simplify debugging end-to-end RPC flows spanning multiple clients and servers. Replace all direct `@opentelemetry/api` usage with `@enkaku/otel` helpers for consistency, reduced boilerplate, and a single source of truth for observability.

## Approach: Full Encapsulation (Thin Wrapper)

All consuming packages import only from `@enkaku/otel`. The `@opentelemetry/api` dependency is removed from all other packages.

## @enkaku/otel API Expansion

### Re-exports from @opentelemetry/api

- `SpanStatusCode` — used by all consuming packages
- `Context` type — used by server for parent context
- `Span` type — already exported
- `TraceFlags` — used in context extraction

### New helpers

- `withActiveContext<T>(context: Context, fn: () => T): T` — wraps `otelContext.with()`
- `getActiveSpan(): Span | undefined` — wraps `trace.getSpan(context.active())`
- `setSpanOnContext(ctx: Context, span: Span): Context` — wraps `trace.setSpan()`

### New semantic constants

- `AttributeKeys.TRANSPORT_SESSION_ID` for HTTP transport session tracking
- `SpanNames.TRANSPORT_SOCKET_CONNECT` to fix misuse of WS name for sockets

### Enhanced withSpan()

- Accept optional parent `Context` parameter for server-side use
- Support returning the span alongside result for post-creation attribute setting

## Tracer Injection

All classes that create spans accept an optional `tracer` in their constructor options, following the same pattern as `logger`:

```typescript
type ClientOptions = {
  logger?: Logger
  tracer?: Tracer  // optional custom tracer
  // ...
}
```

When provided, the custom tracer is used for all spans in that instance. When omitted, falls back to `createTracer('module-name')`. This enables higher-level SDKs wrapping Enkaku to pass their own tracer so spans appear under the wrapper's instrumentation scope.

Applied to: Client, Server, HTTP transports, socket transport, all keystores.

## Per-Package Refactoring

### client (high complexity)

- Remove `@opentelemetry/api` dependency
- Replace `trace.getTracer('enkaku.client')` with `createTracer('client')` or injected tracer
- Replace inline `#injectTraceContext()` with imported `injectTraceContext()` from otel
- Replace manual span management in `sendEvent()`, `request()`, `createStream()`, `createChannel()` with `withSpan()`
- Promise-based span ending: `withSpan()` wraps the full lifecycle by returning the controller's result promise

### server (high complexity)

- Remove `@opentelemetry/api` dependency
- Replace inline `extractTraceContext()` with imported version from otel
- Replace `createHandleSpan()` + `wrapHandle()` with `withSpan()` using parent context parameter
- Access control attributes stay as `span.setAttribute()` calls within `withSpan()` callback

### token, identity (medium complexity)

- Replace `startActiveSpan()` pattern with `withSpan()`
- Straightforward 1:1 replacement

### HTTP transports (medium complexity)

- Replace `startSpan()` + try/finally with `withSpan()`
- Add `AttributeKeys.TRANSPORT_SESSION_ID` for session tracking
- Add W3C `traceparent` header support (see below)

### socket transport (medium complexity)

- Replace `startSpan()` + try/finally with `withSpan()`
- Use new `SpanNames.TRANSPORT_SOCKET_CONNECT`

### All keystores (low complexity)

- Replace `startActiveSpan()` with `withSpan()`

## New Instrumentation

### Stream/Channel lifecycle

- One parent span per stream/channel from creation to close
- Span events (not child spans) for each message/chunk: `stream.message.received`, `stream.message.sent`, `channel.message.received`, `channel.message.sent`
- Message index/sequence number as event attributes

### Execution chain tracing (server)

- `SpanNames.SERVER_HANDLER` span wrapping handler execution, distinct from `SERVER_HANDLE` which covers full request processing including auth
- Already defined in SpanNames but not yet instrumented

### Schema validation events

- Span event on `SERVER_HANDLE` span when validation runs
- Attributes for success/failure and validation error details

### Error enrichment

- All error spans get `enkaku.error.code` and `enkaku.error.message` consistently
- Auth rejection spans get `enkaku.auth.reason` with structured reasons

## Cross-Service Trace Propagation

### Existing mechanism (preserved)

1. Client injects `tid`/`sid` into JWT token headers
2. Server extracts `tid`/`sid` and creates remote parent span context
3. Handler executes within correct OTel context via `context.with()`
4. Any Client created inside a handler auto-inherits the active span context

### Chained call flow

```
Client A (traceId=X)
  → injects tid=X into headers
  → Server A (extracts tid=X, creates child spans)
    → handler runs in correct span context
      → Client B created inside handler
        → auto-inherits traceId=X from active context
        → Server B receives tid=X
          → all spans share traceId=X
```

### Span links

Server's `SERVER_HANDLE` span adds a link back to the client's `CLIENT_CALL` span using extracted `sid`. This provides explicit client-server correlation in trace viewers.

## W3C traceparent Support (HTTP Only)

HTTP transports add W3C `traceparent` header propagation alongside `tid`/`sid`:

- **HTTP client transport**: Injects `traceparent` header on outgoing requests
- **HTTP server transport**: Extracts `traceparent` from incoming requests
- When both `traceparent` and `tid`/`sid` are present, `tid`/`sid` takes precedence
- Enables interoperability with reverse proxies, API gateways, and non-Enkaku services
- Simple format implementation (`00-{traceId}-{parentId}-{flags}`), no additional dependencies needed

Non-HTTP transports (socket, MessagePort, Node.js streams) continue using `tid`/`sid` only.

## Testing Strategy

### Unit tests (per package)

- Verify spans created with correct names, attributes, and status
- Mock tracer to verify `withSpan()` usage
- Test tracer injection: custom tracer used when provided, default when not

### Integration tests

- Cross-service propagation: Client A → Server A → Client B → Server B with shared `traceId`
- Use `@enkaku/standalone` with in-memory OTel exporter
- Verify span parent-child relationships
- Test W3C `traceparent` through HTTP transport

### Stream tracing tests

- Parent span covers full stream lifecycle
- Chunk events recorded with correct sequence numbers
