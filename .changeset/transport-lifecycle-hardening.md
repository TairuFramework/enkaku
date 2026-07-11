---
'@enkaku/transport': minor
'@enkaku/client': minor
'@enkaku/socket': minor
'@enkaku/http-serve': minor
'@enkaku/http-fetch': minor
'@enkaku/server': minor
---

Client and transport lifecycle hardening.

Fixes:

- The client read loop no longer dies on a malformed server message. `#controllers` and `#spans` are null-prototype maps, so a message with `rid: "__proto__"` cannot resolve to `Object.prototype`, and message dispatch is guarded so no throw can kill the loop.
- A graceful remote close now disposes the transport, so in-flight requests are aborted and `handleTransportDisposed` runs instead of every request hanging forever.
- The socket transport keeps a permanent `'error'` listener, so a write on a destroyed socket rejects rather than escalating to an uncaught exception.
- `http-serve` refreshes a session's `lastAccess` on outbound SSE writes, so a passive stream consumer is no longer cut off at `sessionTimeoutMs`.
- `http-serve` rejects a duplicate in-flight request ID with `409` instead of overwriting the first caller's entry.
- An HTTP client that disconnects now aborts its server handler, via the new `requestAborted` transport event.
- In `requireAuth` mode, a channel `send` arriving immediately behind its channel open is no longer dropped.

New options:

- `@enkaku/socket`: `highWaterMark` (default 1 MiB) bounds read and write buffering.
- `@enkaku/http-serve`: `maxSessionBufferBytes` (default 1 MiB) bounds each SSE session's queue; a session that exceeds it is dropped.

Behavior changes:

- `client.sendEvent()` now rejects when the transport write fails for a non-teardown reason. It previously resolved as if the event had been delivered. Over `@enkaku/http-fetch`, a non-2xx response to an event rejects that call alone and leaves the transport usable.
- `http-serve` returns `409` for a duplicate in-flight request ID.
- An `http-serve` SSE session whose buffer overflows is closed rather than growing without bound.

New public API:

- `TransportEvents` gains `requestAborted: { rid: string; reason?: unknown }`.
- `createServerBridge` gains `onRequestAborted`.
- `@enkaku/http-fetch`: `TransportStream` gains `send`, and `ClientTransport.write` uses it rather than the writable's sink.
- `@enkaku/server`: `ServerEvents['handlerAbort'].reason` widened from a literal union to `unknown` (it now also carries transport-defined `requestAborted` reasons).
