# @enkaku/react

## 0.21.3

### Patch Changes

- Add `useCall` and `useAsyncResource` async hooks for managing async-operation and disposable-resource lifecycles, decoupled from the enkaku client.

## 0.21.0

### Patch Changes

- Replace the `canonicalize` dependency with `@sozai/json` in `createRequestKey`.

  `canonicalize` declares `export default fn` but ships `module.exports = fn` — wrong for CJS under `nodenext` — so the import needed a double cast through `unknown` to be callable. `@sozai/json` is native ESM with real types.

  Same RFC 8785 canonical form, same keys. Only difference: values with no canonical representation now throw `TypeError` — `NaN`, `Infinity`, `BigInt`, circular references — where `canonicalize@3.0.0` threw a plain `Error` for all but `BigInt`. Passing any of those as a request argument was already a caller bug; the throw propagates out of `createRequestKey` either way.

- Updated dependencies:
  - @enkaku/client@0.21.0

## 0.19.0

### Patch Changes

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

- Updated dependencies [2b7949c]
  - @enkaku/client@0.19.0

## 0.18.1

### Patch Changes

- Update OTel setup
- Updated dependencies
  - @enkaku/client@0.18.1

## 0.18.0

### Minor Changes

- Split: deps rewired to @sozai/@kokuin, transports renamed, keystore types moved to @kokuin/token.

### Patch Changes

- Updated dependencies
  - @enkaku/client@0.18.0
