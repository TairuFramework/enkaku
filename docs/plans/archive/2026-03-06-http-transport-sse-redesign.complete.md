**Status:** complete

# HTTP Transport SSE Redesign

Replaced the `EventSource`-based SSE implementation in `@enkaku/http-client-transport` and `@enkaku/http-server-transport` with `fetch` + `eventsource-parser` and a POST-based session establishment protocol.

## What changed

### SSE parsing

Replaced browser `EventSource` API with `eventsource-parser`'s callback API (`createParser` + `feed()`). This is pure string processing with zero platform dependencies — works on React Native (Hermes) without polyfills.

### Session protocol

Replaced the three-request GET-based handshake with a single POST:

- **Before:** GET (create session) → GET (open EventSource) → POST (send message) — 3 round-trips
- **After:** First stream/channel POST returns `text/event-stream` response with `enkaku-session-id` header — 1 round-trip

Subsequent stream/channel POSTs include the session ID header and get 204; responses route through the established SSE stream. Single multiplexed SSE connection preserved.

Non-streaming message types (`request`, `event`, `abort`, `send`) unchanged.

### Server transport

- POST handler creates SSE session on first stream/channel request without `enkaku-session-id` header
- Validates existing sessions for subsequent requests with session ID
- GET handler removed entirely
- CORS headers updated: `POST, OPTIONS` methods, added `Access-Control-Expose-Headers: enkaku-session-id`

### Client transport

- `EventStream` type, `createEventStream()`, `EventStreamState` removed
- New `SSESessionState` state machine: `idle → connecting → connected → error`
- SSE consumption via `response.body.getReader()` + `TextDecoder` + `createParser`
- Disposal via `AbortController` (replaces `EventSource.close()`)
- OTel tracing spans preserved

### Dependencies

- Added: `eventsource-parser` (runtime dependency)
- Removed: `undici` (dev dependency, was EventSource polyfill for tests)

## Breaking change

Protocol-level breaking change — server and client must upgrade together.

## Files modified

- `packages/http-client-transport/src/index.ts`
- `packages/http-client-transport/test/lib.test.ts`
- `packages/http-client-transport/package.json`
- `packages/http-server-transport/src/index.ts`
- `packages/http-server-transport/test/lib.test.ts`
- `packages/http-server-transport/test/session-limits.test.ts`
- `pnpm-workspace.yaml`
