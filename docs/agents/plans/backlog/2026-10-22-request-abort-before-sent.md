# Request abort before `sent` settles

**Origin:** kumiai Spec P 2.3a carry-forward, item 4 "Uncancellable hub fetches"
(`kumiai/docs/superpowers/plans/2026-10-18-spec-p-2-3a-carry-forward.md:10`), and the 2.1d runtime
baseline report (`kumiai/docs/superpowers/plans/2026-10-11-spec-p-2-1d-runtime-baseline-stack.md:58`).

## 1. Abort cannot cancel an in-flight HTTP request (primary)

**Consumer impact.** kumiai rpc caps unsettled app requests at four. Over `@enkaku/http-fetch`, four
requests whose responses the server withholds hold all four slots until the server answers. Aborting
them on the caller side does not free a slot, because the call cannot settle while its HTTP request is still in flight.

**Mechanism (verified by reading, 2026-10-22):**
- `packages/client/src/client.ts:190-211` `createRequest` returns `sent.then(() => controller.result)`,
  and `abort()` defers `controller.abort` to `sent.then(...)`. Neither the call promise nor `abort()`
  settles before `sent` does.
- `sent` is `#write(...)` (`client.ts:723`). For HTTP that ends in `send` → `sendClientMessage`
  (`packages/http-fetch/src/index.ts:300-329`) → `sendMessage`, which awaits `runtime.fetch(...)` for the
  whole response (`index.ts:114`).
- The fetch's only signal is the transport-wide `abortController.signal` (`index.ts:86`, `:220`). A
  per-request abort (`config.signal`, `RequestCall.abort()`, or the request timeout at `client.ts:739`)
  never reaches the fetch. `#handleSignal` (`client.ts:582`) aborts the controller and writes an `abort`
  message, but the call promise still waits on `sent`.
- The same `sent.then(...)` sequencing applies to `createStream` / channel (`client.ts:837`, `:961`). Check it there too.

**Wanted behaviour:**
- An aborted or timed-out request settles its call promise immediately, rejecting with the abort reason,
  even while `sent` is pending.
- The underlying HTTP fetch for that request is cancelled, using a per-message signal combined with the
  transport signal.
- An `abort` message is still sent best-effort. A late response for an aborted rid is dropped.
- A `sent` rejection after an abort is absorbed, with no unhandled rejection.

**Suggested shape (not binding):**
- Let `Transport.write` / `ClientTransport.send` accept an optional per-message `AbortSignal`.
- `http-fetch` passes the transport signal combined with the per-message signal to `fetch`.
- `client` builds the call promise from `controller.result`, with `sent`'s rejection forwarded into the controller, instead of `sent.then(() => controller.result)`.

**Tests:**
- A server handler that never responds, plus `call.abort()`: the call rejects within one tick, and the fetch's `signal.aborted` is true.
- The same with `config.signal` and with `timeout`.
- Four withheld requests are aborted, then a fifth request succeeds.
- Ordering of stream/channel messages (`sendSerial`, `index.ts:357`) is unchanged.

## 2. Runtime APIs: no enkaku change

These are covered by a platform polyfill in `@sozai/runtime-expo`, as an import of `@sozai/runtime-expo/polyfill`
that must come first. See `sozai/docs/agents/plans/backlog/2026-10-22-runtime-expo-signal-dispose-polyfills.md`.
- `client.ts:588` uses `AbortSignal.any`.
- `@enkaku/transport` `Transport` / `DirectTransports` inherit `Symbol.asyncDispose` from `@sozai/async` `Disposer` (`packages/transport/src/index.ts:13`, `:54`, `:159`).

enkaku keeps idiomatic use. Optional: in the README for RN/Expo consumers, mention the polyfill import.
If enkaku has an RN/Expo example app, add the import there.
