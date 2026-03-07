**Status:** superseded by `docs/plans/2026-03-06-http-transport-sse-redesign-design.md`

# Enkaku HTTP Transport: Replace EventSource with fetch-based SSE

## Problem

The current `@enkaku/http-client-transport` uses the browser `EventSource` API to receive server-sent events (SSE). This breaks in environments that lack `EventSource`:

- **React Native (Hermes)**: No built-in `EventSource`
- **Node.js**: Requires polyfill (e.g., `undici`)
- **Edge runtimes**: Partial or no support

The `fetch` API with streaming response bodies is universally available across all these environments. The `parse-sse` library (zero dependencies, ~100 lines) parses SSE from any `fetch` `Response` using standard `ReadableStream`/`TransformStream` primitives.

## Current Architecture

### Client transport (`@enkaku/http-client-transport`)

Session establishment requires two sequential GETs, then POSTs carry messages:

```
1. GET  /rpc          -> JSON { id: "session-123" }
2. GET  /rpc?id=...   -> EventSource SSE stream (text/event-stream)
3. POST /rpc          -> JSON message (with enkaku-session-id header)
```

The SSE stream is lazily created only when a `stream` or `channel` message is sent. `request` type messages use POST-and-wait (no SSE needed).

Key issues with `EventSource`:
- Requires `globalThis.EventSource` to exist
- Auto-reconnects on error (Enkaku disables this by closing on error)
- Error events are opaque `Event` objects with no useful diagnostic info
- Only supports GET (no custom headers on the SSE connection itself)

### Server transport (`@enkaku/http-server-transport`)

The server handles:
- `GET` without `id` param: Creates session, returns `{ id }` as JSON
- `GET` with `id` param: Opens SSE stream, stores the `ReadableStreamDefaultController`
- `POST`: Enqueues client messages; for `request` type, waits for handler response and returns it as JSON; for `stream`/`channel` type, sends 204 and routes responses through the SSE stream

SSE events are formatted manually: `data: ${JSON.stringify(msg)}\n\n`

## Proposed Design

### Inspiration: MCP Streamable HTTP

The [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http) uses a cleaner model worth adopting:

| Aspect | MCP Streamable HTTP | Current Enkaku | Proposed Enkaku |
|--------|-------------------|----------------|-----------------|
| SSE initiation | POST returns SSE stream | Separate GET creates EventSource | POST returns SSE stream |
| Session ID | Response header (`Mcp-Session-Id`) | Two-step GET handshake | Response header (`Enkaku-Session-Id`) |
| Request-response | POST -> JSON or SSE | POST -> JSON (waits for response) | POST -> JSON (no change) |
| Stream/channel | Via pre-established EventSource | Via pre-established EventSource | POST -> SSE response stream |
| Server notifications | GET -> SSE stream | N/A | Optional GET -> SSE stream |
| SSE parsing | Client uses fetch + SSE parser | Client uses EventSource | Client uses fetch + `parse-sse` |

### Key design change: POST returns SSE for streams

Instead of establishing a shared SSE connection upfront and routing all stream responses through it, each `stream`/`channel` POST returns its own SSE response stream. This eliminates the session handshake entirely for the common case.

```
# Current flow (stream message):
GET  /rpc           -> { id: "abc" }           # get session ID
GET  /rpc?id=abc    -> EventSource SSE stream  # open SSE
POST /rpc           -> 204 (session-id: abc)   # send stream request
                    <- SSE events on EventSource # receive stream data

# Proposed flow (stream message):
POST /rpc           -> text/event-stream        # send request, receive SSE response
                    <- SSE events inline         # stream data in response body
```

### Phased implementation

#### Phase 1: Replace EventSource with fetch + parse-sse (client only)

Minimal change. Keep the same two-GET session protocol but replace `EventSource` with `fetch` + `parse-sse`.

**Client transport changes:**

```ts
// Before (requires EventSource):
const source = new EventSource(sourceURL)
source.addEventListener('message', (event) => {
  controller.enqueue(JSON.parse(event.data))
})

// After (fetch + parse-sse):
import { parseServerSentEvents } from 'parse-sse'

const response = await fetch(sourceURL.toString(), {
  headers: { accept: 'text/event-stream' },
})
const processEvents = async () => {
  for await (const event of parseServerSentEvents(response)) {
    if (event.data) {
      controller.enqueue(JSON.parse(event.data))
    }
  }
}
processEvents().catch((error) => {
  controller.error(new Error('SSE stream failed', { cause: error }))
})
```

**What changes:**
- Replace `EventSource` constructor with `fetch()` call
- Replace event listeners with async iteration over `parseServerSentEvents()`
- Remove `EventSource.close()` calls, use `AbortController` to cancel the fetch instead
- Add `parse-sse` as dependency to `@enkaku/http-client-transport`

**What stays the same:**
- Server transport: unchanged
- Session handshake protocol: unchanged (GET without id -> GET with id)
- Message routing: unchanged

**Server transport compatibility:**
The server already returns a proper `text/event-stream` response with `ReadableStream` body (line 253 of `http-server-transport/src/index.ts`). The `:\n\n` comment flush on line 245 works with both `EventSource` and `parse-sse`.

**Benefits:**
- Fixes React Native, Node.js, and edge runtime compatibility
- Zero new runtime dependencies (`parse-sse` is ~100 lines, zero deps)
- No server changes needed
- No protocol changes needed
- Tests can drop the `undici` EventSource polyfill

**Cleanup:**
- Remove `EventStream` type (replace with `AbortController` + processing promise)
- Remove `EventStreamState` state machine (simplify to connected/error)
- Remove `createEventStream()` function
- Update tests to remove `EventSource` mocking

#### Phase 2: Inline SSE responses on POST (MCP-style)

Larger change affecting both client and server. Stream/channel responses come back as SSE on the POST response body itself.

**Server transport changes:**
- For `stream`/`channel` POST: instead of returning 204 and routing to a separate SSE session, return a `text/event-stream` response with the stream data inline
- Remove session management for stream routing (sessions only needed for server-initiated messages)
- Keep session support as optional for server-initiated notifications (GET -> SSE)

**Client transport changes:**
- For `stream`/`channel` messages: read SSE from the POST response body using `parse-sse`
- No need for pre-established SSE connection
- Simplify `createTransportStream` significantly

**Protocol header:**
- Use `Enkaku-Session-Id` response header (like MCP's `Mcp-Session-Id`) instead of the two-GET handshake
- Session only needed if server wants to send unsolicited messages

**Benefits:**
- Eliminates session handshake for streams (1 request instead of 3)
- Each stream is independent (no shared SSE connection)
- Simpler error handling (stream error = response error)
- Better resource management (connection closed when stream ends)
- Aligns with MCP Streamable HTTP pattern

**Trade-offs:**
- Multiple concurrent streams = multiple open HTTP connections (acceptable for typical usage)
- Server transport needs changes (but becomes simpler overall)
- Breaking change for existing server/client pairs (version bump needed)

#### Phase 3 (optional): Server-initiated messages via GET SSE

Add support for server-initiated messages (notifications, requests) via GET:

```
GET /rpc -> text/event-stream (long-lived, server pushes messages)
```

This is orthogonal to stream handling. Only needed if Enkaku wants to support server-to-client push outside of stream responses.

## File impact

### Phase 1 (minimal, non-breaking)

| File | Change |
|------|--------|
| `packages/http-client-transport/package.json` | Add `parse-sse` dependency |
| `packages/http-client-transport/src/index.ts` | Replace `EventSource` with `fetch` + `parse-sse` |
| `packages/http-client-transport/test/lib.test.ts` | Replace `EventSource` mocks with fetch mocks |
| `packages/http-server-transport/src/index.ts` | No changes |

### Phase 2 (protocol change)

| File | Change |
|------|--------|
| `packages/http-client-transport/src/index.ts` | Read SSE from POST response body for stream/channel |
| `packages/http-server-transport/src/index.ts` | Return SSE response for stream/channel POSTs |
| `packages/http-server-transport/test/` | Update tests |
| `packages/http-client-transport/test/` | Update tests |

## Testing

### Phase 1

- Unit tests: mock `fetch` to return `text/event-stream` responses, verify SSE parsing
- Integration tests: existing Enkaku integration tests should pass without `EventSource` polyfill
- Cross-environment: verify in Node.js (no polyfill), browser, and React Native (via Kubun shopping app)

### Phase 2

- Unit tests: verify POST -> SSE response flow for stream/channel
- Integration tests: full stream lifecycle (create, receive messages, complete)
- Backwards compatibility: ensure `request` type still works as JSON POST/response

## Recommendation

**Start with Phase 1.** It solves the immediate React Native problem, requires no protocol changes, and no server modifications. Phase 2 can follow as a protocol improvement in a later version.
