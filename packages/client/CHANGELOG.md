# @enkaku/client

## 0.21.1

### Patch Changes

- Add a per-request timeout to `Client.request`: a `requestTimeoutMs` client-construction default and a per-call `timeout` config override. On expiry the in-flight request is aborted through the existing abort path and rejects with a new exported `RequestTimeoutError` (a `RequestError` subclass carrying `code: 'RequestTimeout'` and `{ procedure, timeoutMs }`). An explicit `timeout` of `0`, a negative, `NaN`, or a non-finite value disables the timer; streams and channels are never auto-timed-out.
- Add a leak-free `dispose(reason?: string)` to stream and channel calls: it aborts the call's own read loop, closes the receive stream, removes the controller from the client map, and resolves once local teardown is done, with no unhandled rejection regardless of transport-teardown ordering and no consumer-side rejection-absorbing guard. A disposed channel rejects sends begun after disposal. Disposal is now classified as an `aborted` (not `error`) lifecycle outcome.

## 0.21.0

### Minor Changes

- **Breaking:** raise the `@kokuin/token` floor to `^0.4.0` and `@kokuin/capability` to `^0.2.2`. Two upstream breaks reach the wire:

  - A `did:peer:4` signer now embeds its long form in `iss` for any payload without a single string `aud`. Enkaku only sets `aud` when the client is given a `serverID`, so messages signed without one change shape. Pass `embedLongForm: false` to the identity to keep the short form.
  - Base64 decoding is canonical-only. A signature or token carrying a non-canonical base64url spelling now throws `Invalid base64url encoding` instead of verifying. Every encoder in this stack emits canonical output; only hand-built or third-party payloads are affected.

  No API these packages call changed. Consumers pinned to `@kokuin/token@0.2.x`/`0.3.x` must upgrade in step.

- **Breaking:** the `getRandomID` option is removed from `ServerBaseParams`, `ClientParams`, `ServerBridgeOptions`, `ServerTransportOptions` and `StandaloneOptions`. Pass a `Runtime` instead:

  ```ts
  // before
  new Client({ transport, getRandomID })
  // after
  new Client({ transport, runtime: createRuntime({ getRandomID }) })
  ```

  `getRandomID` was shorthand for exactly that, and passing both silently discarded it — a caller supplying a custom generator alongside a runtime got `crypto.randomUUID()` with no warning.

  `@enkaku/standalone` gains the `runtime` option it was missing, threaded through to both client and server so they share one generator.

- **Breaking (wire format):** trace context travels over W3C `traceparent`/`tracestate` instead of the custom `tid`/`sid` header pair, adopting `@sozai/otel` `^0.3.0`. Old and new peers still interoperate, but the server no longer sees the client's trace context — their spans land in separate traces instead of one.

  The removed `injectTraceContext`/`extractTraceContext` were a second, unvalidated encoding: no trace/span ID validation, and `TraceFlags.SAMPLED` hardcoded, so any string became a remote `SpanContext` and every remote trace was force-sampled. The span link the server builds from the caller's context now carries the caller's real sampling flags.

  `@enkaku/http-serve` reads the inbound `traceparent` header directly. `@enkaku/http-fetch` omits the header when `formatTraceparent` returns `undefined`, instead of sending the literal string `undefined`.

### Patch Changes

- Constructing with an **already-aborted** signal now actually disposes. Requires `@sozai/async` `^0.2.1`.

  The dispose callback used to run synchronously from inside `Disposer`'s `super()`, before the subclass had initialized. Its first `this` access threw a `ReferenceError` that `Disposer` swallowed into a *resolved* `disposed`: teardown never ran, and the caller was told it succeeded. `Transport`, `DirectTransports` and `Server` were all affected — a `Server` reported a successful `dispose()` while never disposing its transports, aborting its handlers, or clearing its cleanup interval.

  `@sozai/async@0.2.1` defers the invocation by a microtask, so the derived constructor always completes first. The three local microtask yields written to work around this are removed. The `^0.2.1` floor is load-bearing — on `0.2.0` an already-aborted signal silently disposes nothing.

- Updated dependencies:
  - @enkaku/otel@0.21.0

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

### Patch Changes

- @enkaku/otel@0.19.0

## 0.18.1

### Patch Changes

- Update OTel setup
- Updated dependencies
  - @enkaku/otel@0.18.1

## 0.18.0

### Minor Changes

- Split: deps rewired to @sozai/@kokuin, transports renamed, keystore types moved to @kokuin/token.
