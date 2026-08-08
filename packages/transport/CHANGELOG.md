# @enkaku/transport

## 0.21.0

### Patch Changes

- Constructing with an **already-aborted** signal now actually disposes. Requires `@sozai/async` `^0.2.1`.

  The dispose callback used to run synchronously from inside `Disposer`'s `super()`, before the subclass had initialized. Its first `this` access threw a `ReferenceError` that `Disposer` swallowed into a *resolved* `disposed`: teardown never ran, and the caller was told it succeeded. `Transport`, `DirectTransports` and `Server` were all affected — a `Server` reported a successful `dispose()` while never disposing its transports, aborting its handlers, or clearing its cleanup interval.

  `@sozai/async@0.2.1` defers the invocation by a microtask, so the derived constructor always completes first. The three local microtask yields written to work around this are removed. The `^0.2.1` floor is load-bearing — on `0.2.0` an already-aborted signal silently disposes nothing.

- **Behaviour change:** `Transport` forwards `params.signal` to its `Disposer`, so aborting that signal now disposes the transport. It was previously accepted, declared on `TransportParams`, and silently dropped. Every subclass (`SocketTransport`, `NodeStreamsTransport`, `MessageTransport`) passes `signal` up, so all of them leaked their underlying resource on abort. If you pass a `signal` and rely on it *not* disposing, stop passing it.

  Abort now runs the same graceful teardown as `dispose()`: emit `disposing`, flush queued writes, emit `disposed`, release the resource.

  `Transport.dispose()` awaits that flush with no deadline of its own — the bound is a property of the sink. `@enkaku/socket` bounds it (`END_GRACE_MS`); `MessageTransport`, `NodeStreamsTransport` and third-party transports do not. `@enkaku/server` bounds every wait it makes on `transport.dispose()` by `cleanupTimeoutMs`, so a sink that never drains cannot hang a server — a direct caller of `dispose()` gets whatever its sink provides.

## 0.19.0

### Minor Changes

- 2b7949c: Client and transport lifecycle hardening.

  Fixes:

  - The client read loop no longer dies on a malformed server message. `#controllers` and `#spans` are null-prototype maps, so a message with `rid: "__proto__"` cannot resolve to `Object.prototype`, and message dispatch is guarded so no throw can kill the loop.
  - A graceful remote close now disposes the transport, so in-flight requests are aborted and `handleTransportDisposed` runs instead of every request hanging forever.
  - The socket transport keeps a permanent `'error'` listener, so a write on a destroyed socket rejects rather than escalating to an uncaught exception.
  - `http-serve` refreshes a session's `lastAccess` on outbound SSE writes, so a passive stream consumer is no longer cut off at `sessionTimeoutMs`.
  - `http-serve` rejects a duplicate in-flight request ID with `409` instead of overwriting the first caller's entry.
  - An HTTP client that disconnects now aborts its server handler, via the new `requestAborted` transport event.
  - In `requireAuth` mode, a channel `send` arriving immediately behind its channel open is no longer dropped.
  - Over `@enkaku/http-fetch`, a channel `send` issued right after `createChannel()` no longer overtakes the channel open on the wire.
  - Replacing a client transport no longer lets the read loop of the replaced transport dispose its replacement when the old readable ends.
  - `Server.dispose()` waits for in-flight access checks, so an authenticated request can no longer start its handler — with a signal nothing can abort — after `dispose()` resolved.

  New options:

  - `@enkaku/socket`: `highWaterMark` (default 1 MiB) bounds read and write buffering.
  - `@enkaku/http-serve`: `maxSessionBufferBytes` (default 1 MiB) bounds each SSE session's queue; a session that exceeds it is dropped.

  Behavior changes:

  - `client.sendEvent()` now rejects when the transport write fails for a non-teardown reason. It previously resolved as if the event had been delivered. Over `@enkaku/http-fetch`, a non-2xx response to an event rejects that call alone and leaves the transport usable.
  - `@enkaku/react`: `useSendEvent()` and `ReactClient.sendEvent()` propagate the client change above — they now **reject** on a write failure instead of resolving as if the event had been delivered.
  - `http-serve` returns `409` for a duplicate in-flight request ID.
  - An `http-serve` SSE session whose buffer overflows is closed rather than growing without bound.
  - `@enkaku/http-serve` answers a request whose client disconnected before the reply with the `499` status.
  - `@enkaku/server`: `Server.handle()` now requires `transport.events` at runtime — it subscribes to the transport's `requestAborted` event. `TransportType` already declares `events` as non-optional, so typed consumers are unaffected, but a duck-typed transport double or a JavaScript consumer without an `events` emitter now throws.

  New public API:

  - `TransportEvents` gains `requestAborted: { rid: string; reason?: unknown }`.
  - `createServerBridge` gains `onRequestAborted`.
  - `@enkaku/http-fetch`: `TransportStream` gains `send`, and `ClientTransport.write` uses it rather than the writable's sink. Calls to `send` are serialized, so a channel `send` cannot overtake the `channel` open it belongs to.
  - `@enkaku/socket`: new exported type `CreateTransportStreamOptions<R>` (`FromJSONLinesOptions<R>` plus `highWaterMark`). `SocketTransportParams<R>` is now based on it (`CreateTransportStreamOptions<R> & { socket, signal }`), so it carries the buffering options alongside the JSON-lines ones.
  - `@enkaku/server`: `ServerEvents['handlerAbort'].reason` widened from a literal union to `unknown` (it now also carries transport-defined `requestAborted` reasons).

## 0.18.1

### Patch Changes

- Update OTel setup

## 0.18.0

### Minor Changes

- Split: deps rewired to @sozai/@kokuin, transports renamed, keystore types moved to @kokuin/token.
