# Observability & Tracing Design

End-to-end observability for Enkaku using OpenTelemetry-compatible spans with logtape structured logging.

---

## Goals

- Trace a request from key generation through client signing, transport, server auth, handler execution, and response — end to end
- Correlate auth failures with the signing key that caused them (via DID)
- Provide general-purpose span utilities for both framework internals and consumer code
- Zero overhead when OTel is not configured
- Full OTel ecosystem compatibility (Jaeger, Datadog, Honeycomb, etc.)

## Architecture

### Approach

New `@enkaku/otel` package providing span utilities and a logtape-to-OTel log bridge. Core packages (`client`, `server`, `token`, keystores, transports) use `@opentelemetry/api` as an optional peer dependency for direct span creation. When no OTel SDK is configured, all instrumentation is no-op.

### Trace Context Propagation

Trace IDs flow via token headers across the client-server boundary:

```typescript
// Token header carries trace context
{
  typ: 'JWT',
  alg: 'EdDSA' | 'ES256' | 'none',
  tid?: string,  // trace ID (W3C-compatible 32-hex-char)
  sid?: string,  // span ID (16-hex-char)
}
```

- **Auto-generated** per client call (request, event, stream, channel)
- **Overridable** by consumers passing their own trace ID (e.g., from upstream OTel context)
- Server extracts `tid`/`sid` from token header and creates a child span linked to the client's span

### Key Correlation via DID

The DID (`did:key:z...`) is a span attribute (not the primary correlation mechanism):
- Logged at `info` level when a keystore generates or retrieves a key
- Recorded as a span attribute when signing tokens
- Recorded as a span attribute on server auth errors
- Searching by DID links key generation to auth failures

## New Package: `@enkaku/otel`

```
packages/otel/
├── src/
│   ├── index.ts              # Barrel exports
│   ├── tracers.ts            # Enkaku-namespaced tracer creation
│   ├── context.ts            # Trace context inject/extract for token headers
│   ├── log-sink.ts           # Logtape sink that bridges to OTel LoggerProvider
│   └── semantic.ts           # Span name constants and attribute keys
├── package.json
└── tsconfig.json
```

**Dependencies:**
- `@opentelemetry/api` — peer dependency
- `@enkaku/log` — for the log sink bridge

**Exports:**
```typescript
// General-purpose tracer creation
createTracer(name: string): Tracer

// Wrap any operation in a span
withSpan<T>(tracer: Tracer, name: string, options: SpanOptions, fn: (span: Span) => Promise<T>): Promise<T>

// Get active trace context for propagation
getActiveTraceContext(): { traceId: string; spanId: string; traceFlags: number } | undefined

// Inject/extract trace context into/from token headers
injectTraceContext(header: Record<string, unknown>): Record<string, unknown>
extractTraceContext(header: Record<string, unknown>): Context | undefined

// Logtape sink bridging to OTel LoggerProvider
createOTelLogSink(): Sink

// Span name constants
SpanNames: Record<string, string>
// Attribute key constants
AttributeKeys: Record<string, string>
```

## Span Architecture

### Span Hierarchy

```
enkaku.client.call                          # Root span for a client call
├── enkaku.token.sign                       # Token signing
│   └── attributes: { did, algorithm }
├── enkaku.transport.write                  # Transport write
│   └── attributes: { transport_type }
└── enkaku.client.response                  # Waiting for response
    └── attributes: { response_type: result|error }

enkaku.server.handle                        # Server-side root span (child of client via tid/sid)
├── enkaku.token.verify                     # Token verification
│   └── attributes: { did, algorithm }
├── enkaku.server.access_control            # Access control check
│   └── attributes: { procedure, did, allowed }
├── enkaku.server.handler                   # User handler execution
│   └── attributes: { procedure, rid }
└── enkaku.transport.write                  # Response transport write

enkaku.keystore.get_or_create               # Keystore operations (standalone span)
└── attributes: { did, key_created, store_type }
```

### Stream/Channel Operations

Stream and channel value send/receive are recorded as **span events** on the parent span (not child spans) to avoid span explosion.

### Transport Spans

- `enkaku.transport.http.request` — HTTP POST requests
- `enkaku.transport.http.sse_connect` — SSE connection establishment
- `enkaku.transport.ws.connect` — WebSocket connection
- `enkaku.transport.ws.message` — WebSocket message send/receive

Span attributes follow OTel semantic conventions where applicable (`rpc.method`, `rpc.system`).

## Changes to Existing Packages

| Package | Changes |
|---------|---------|
| `@enkaku/client` | Optional `@opentelemetry/api` peer dep. Wrap calls in spans. Inject trace context into token headers. |
| `@enkaku/server` | Optional `@opentelemetry/api` peer dep. Extract trace context from headers. Wrap handler execution in spans. Enrich logger with trace IDs. |
| `@enkaku/token` | Optional `@opentelemetry/api` peer dep. Span around sign/verify operations. |
| `@enkaku/node-keystore` | Optional `@opentelemetry/api` peer dep. Span around key get/create. Log DID at info level. |
| `@enkaku/browser-keystore` | Same as node-keystore. |
| `@enkaku/expo-keystore` | Same as node-keystore. |
| `@enkaku/electron-keystore` | Same as node-keystore. |
| `@enkaku/http-client-transport` | Optional `@opentelemetry/api` peer dep. Span around HTTP requests and SSE setup. |
| `@enkaku/http-server-transport` | Optional `@opentelemetry/api` peer dep. Span around request handling. |
| `@enkaku/socket-transport` | Optional `@opentelemetry/api` peer dep. Span around connect/message ops. |
| `@enkaku/log` | Enhance `getEnkakuLogger` to auto-enrich with OTel trace context when available. No hard dependency. |

## Error Enrichment

Auth errors gain structured attributes for debugging:

| Auth Failure | Span Attributes | Log Message |
|---|---|---|
| Unsigned message in private mode | `{ reason: "unsigned_message" }` | `[WARN] Message is not signed` |
| Invalid signature | `{ reason: "invalid_signature", did, alg }` | `[WARN] Invalid signature for {did}` |
| Audience mismatch | `{ reason: "invalid_audience", expected, actual }` | `[WARN] Invalid audience: expected {expected}, got {actual}` |
| Key not in access list | `{ reason: "access_denied", did, procedure }` | `[WARN] Access denied for {did} on {procedure}` |
| Token expired | `{ reason: "token_expired", did, exp }` | `[WARN] Token expired for {did} at {exp}` |

## Logging Level Strategy

| Level | Usage |
|---|---|
| `trace` | Individual message read/write, value send/receive, detailed protocol events |
| `debug` | Error responses, transport lifecycle events, controller management |
| `info` | Key generation, connection established, server started, handler added |
| `warn` | Auth failures, access denied, public mode warnings, encryption policy violations |
| `error` | Unhandled handler errors, transport failures, unexpected state |

Logtape logs automatically include `traceId` and `spanId` when an OTel span is active.

## Consumer Setup

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { createOTelLogSink } from '@enkaku/otel'
import { setup, getConsoleSink } from '@enkaku/log'

// 1. Set up OTel SDK (consumer's responsibility)
const sdk = new NodeSDK({ /* exporters, etc */ })
sdk.start()

// 2. Optionally bridge logs to OTel
setup({
  sinks: {
    console: getConsoleSink(),
    otel: createOTelLogSink(),
  },
  loggers: [
    { category: ['enkaku'], lowestLevel: 'debug', sinks: ['console', 'otel'] }
  ]
})

// 3. Use client/server normally — spans are created automatically
```

When OTel is not configured, `@opentelemetry/api` returns no-op tracers with negligible overhead.

## Example Flow: Key Generation → Auth Failure

```
1. KEYSTORE: Key Generated
   Span: enkaku.keystore.get_or_create { did: "did:key:z6Mk...", key_created: true, store_type: "node" }
   Log:  [INFO] [enkaku.keystore] New signing key generated { did: "did:key:z6Mk..." }

2. CLIENT: Makes a request
   Span: enkaku.client.call { procedure: "myService.getData", rid: "abc-123" }
     → enkaku.token.sign { did: "did:key:z6Mk...", alg: "EdDSA" }
       Token header: { tid: "aabbccdd...", sid: "11223344..." }
     → enkaku.transport.write { transport: "http" }
       → enkaku.transport.http.request { method: "POST", status: 200 }
   Log:  [TRACE] [enkaku.client] send request myService.getData { traceId: "aabbccdd...", did: "did:key:z6Mk..." }

3. SERVER: Receives and rejects
   Span: enkaku.server.handle { procedure: "myService.getData", rid: "abc-123" }
     (linked to client span via tid/sid)
     → enkaku.token.verify { did: "did:key:z6Mk...", alg: "EdDSA" } — OK
     → enkaku.server.access_control { did: "did:key:z6Mk...", procedure: "myService.getData", allowed: false } — ERROR
   Log:  [WARN] [enkaku.server] Access denied for did:key:z6Mk... on myService.getData { traceId: "aabbccdd...", code: "EK02" }

4. CLIENT: Receives error
   Span: enkaku.client.call (updated) — ERROR { error_code: "EK02", error_msg: "Access denied" }
   Log:  [DEBUG] [enkaku.client] error reply for request myService.getData { traceId: "aabbccdd..." }
```

**Debugging**: Search by DID to find key generation + all requests/failures. Search by trace ID to see the full request flow.
