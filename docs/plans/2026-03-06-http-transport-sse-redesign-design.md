# HTTP Transport SSE Redesign — Design

## Problem

The current `@enkaku/http-client-transport` depends on the browser `EventSource` API for server-sent events. This breaks in React Native (Hermes), requires polyfills in Node.js, and has partial support in edge runtimes. The session handshake also requires three round-trips before the first stream response can arrive.

## Goals

- Full React Native (Hermes) support without polyfills
- Simplify session establishment (fewer round-trips)
- Keep the single multiplexed SSE connection for all streams/channels
- Maintain current error handling and lifecycle semantics

## Design

### SSE parsing: `eventsource-parser` callback API

Replace `EventSource` with `fetch` + `eventsource-parser`'s `createParser`/`feed()` callback API.

The callback API is pure string processing — no `TextDecoderStream`, no `TransformStream`, no platform-specific polyfills. `TextDecoder` (without "Stream") is available in Hermes. This makes it the strongest choice for React Native compatibility.

Usage pattern:

```ts
import { createParser } from 'eventsource-parser'

const response = await fetch(url, { method: 'POST', body, headers })
const reader = response.body!.getReader()
const decoder = new TextDecoder()
const parser = createParser({
  onEvent: (event) => {
    controller.enqueue(JSON.parse(event.data))
  },
})

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  parser.feed(decoder.decode(value, { stream: true }))
}
```

Why `eventsource-parser` over alternatives:

| Library | Downloads/week | Platform deps | React Native |
|---------|---------------|---------------|--------------|
| `eventsource-parser` | 23.6M | None (callback API) | Works without polyfills |
| `parse-sse` | 33K | `TextDecoderStream` | Needs polyfill |
| Hand-rolled | N/A | Your choice | Your choice, but chunk-boundary edge cases are subtle |

### Protocol: POST-based SSE establishment

Replace the two-GET handshake with a single POST that returns the SSE stream.

#### Current flow (3 requests before first stream response):

```
GET  /rpc           -> { id: "abc" }           # create session
GET  /rpc?id=abc    -> EventSource SSE stream   # open SSE
POST /rpc           -> 204 (session-id: abc)    # send stream request
                    <- SSE events on EventSource # receive stream data
```

#### New flow (1 request):

```
POST /rpc           -> text/event-stream        # first stream/channel POST
                       Enkaku-Session-Id: <uuid> # session ID in response header
                    <- SSE events in body        # multiplexed stream data

POST /rpc           -> 204                       # subsequent stream/channel POSTs
  (Enkaku-Session-Id header included)            # responses via established SSE
```

Non-streaming message types are unchanged:

- `request` POST -> JSON response (no session needed)
- `event`/`abort`/`send` POST -> 204 (no session needed)

#### Client state machine

Same shape as current `EventStreamState`, triggered by POST instead of GET:

```
idle -> connecting (first stream/channel POST in flight, awaiting response headers)
     -> connected  (got Enkaku-Session-Id from response header, SSE body being consumed)
     -> error
```

Parallel stream/channel calls during `connecting` await the same promise, then POST with the session ID.

#### Server changes

- POST handler for `stream`/`channel`: if no session exists for the request, create one and return `text/event-stream` response with `Enkaku-Session-Id` header. If session exists (header present), return 204 as before.
- Remove GET-based session creation and SSE establishment.
- Session cleanup unchanged (timeout + abort signal).
- `request`/`event`/`abort`/`send` handling unchanged.

### Error handling and connection lifecycle

All behavior matches current implementation:

- **SSE connection failure:** State moves to `error`, readable stream errors. Parallel callers waiting on the connecting promise receive the same error.
- **SSE stream drops mid-session:** No reconnection. Server deletes session on disconnect (current behavior — `EventSource` auto-reconnect was explicitly disabled). All active streams/channels fail. Client transport is dead; consumer creates a new one.
- **Server-side cleanup:** `request.signal` abort listener cleans up the session. Inflight requests for dead sessions get `onWriteError` callbacks.

### What we keep

- Single multiplexed SSE connection for all streams/channels
- Lazy SSE creation (only when stream/channel is needed)
- Session timeout and cleanup logic
- All current message routing (inflight map, rid-based dispatch)
- `request` type POST -> JSON response pattern

### What we drop

- `EventSource` dependency
- Two-GET handshake (`createEventStream()` function)
- `EventStreamState` type (replaced by equivalent state in new code)
- `undici` dev dependency (EventSource polyfill for tests)

### Breaking change

This is a protocol-level breaking change. Server and client must upgrade together. Requires a minor version bump.

## Dependencies

- Add: `eventsource-parser` to `@enkaku/http-client-transport`
- Remove: `undici` dev dependency from `@enkaku/http-client-transport`

## File impact

| File | Change |
|------|--------|
| `packages/http-client-transport/package.json` | Add `eventsource-parser`, remove `undici` |
| `packages/http-client-transport/src/index.ts` | Replace `EventSource` with `fetch` + `eventsource-parser`. Replace GET-based session with POST-based. |
| `packages/http-server-transport/src/index.ts` | POST handler returns SSE for first stream/channel. Remove GET session/SSE handlers. |
| `packages/http-client-transport/test/lib.test.ts` | Remove `EventSource` mocking. Mock `fetch` to return SSE responses with `Enkaku-Session-Id` header. |
| `packages/http-server-transport/test/lib.test.ts` | Update stream/channel tests for POST-based SSE. Remove GET session tests. |
| `packages/http-server-transport/test/session-limits.test.ts` | Update for POST-based session creation. |

## Testing

- Unit tests: mock `fetch` to return `text/event-stream` responses, verify SSE parsing and session ID flow
- Verify parallel stream/channel calls share one SSE connection
- Verify `request` type still works as JSON POST/response
- Integration: verify in Node.js without any EventSource polyfill
- React Native verification deferred to Kubun integration (external repo)
