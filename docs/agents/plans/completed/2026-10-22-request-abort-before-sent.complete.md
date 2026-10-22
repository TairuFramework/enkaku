# client + http-fetch: request abort before `sent` settles

**Status:** complete
**Date:** 2026-10-22
**Packages:** `@enkaku/client`, `@enkaku/http-fetch`

Origin: kumiai Spec P 2.3a carry-forward, item 4 "Uncancellable hub fetches". kumiai rpc caps unsettled app requests at four. Over `@enkaku/http-fetch`, aborting a request whose response the server withholds freed no slot. The call promise and `abort()` both waited on `sent`, which spans the whole `fetch` round trip, and per-request aborts never reached the fetch. Two needs were wanted: the call settles on abort, and the HTTP fetch is cancelled so the connection is released (browser/RN per-origin limits).

## What was built

- **Client settles immediately.** A request, stream or channel call rejects as soon as `call.abort()`, `config.signal` or the request timeout fires, even while its write is pending. The call promise is `controller.result`. `sent` only forwards its rejection, unchanged, through `controller.error` when the controller has not settled. A pre-aborted `config.signal` still rejects with the signal object.
- **Settled calls are never written.** `#write` skips `transport.write` for a non-`abort` payload whose owner settled during async message creation. A send failure removes the rid's controller, identity-checked.
- **`cancelOnAbort?: boolean` on http-fetch `ClientTransportParams`** (default `false`). It keeps a per-rid `AbortController` map, filled at `sendSerial` entry for `request` and stream/channel opens. An outgoing `abort` fires it before the abort is queued in `ridChains`. Each POST then gets `AbortSignal.any([transportSignal, perRidSignal])`, built lazily inside `send`'s `try`. Queued or session-waiting work checks the cancel and skips its POST. A cancelled fetch or body read resolves quietly. Cleanup is identity-checked and runs after the body is consumed.
- **Existing http-fetch bugs fixed, whatever the option is set to:**
  - Every POST now carries the transport signal, so `dispose()` cancels in-flight requests.
  - A failed `abort` POST (fetch rejection, bad JSON, or non-OK response) no longer errors the shared readable or enqueues a synthetic `EK_HTTP_REQUEST_FAILED` reply.
  - A body-read rejection during dispose no longer errors the readable.
- **Client falsy params fixed:** `0`, `''` and `false` are now sent as `prm` (`prm != null`). `null` is still omitted.
- Tests:
  - `packages/client/test/abort-before-sent.test.ts`, `falsy-params.test.ts`.
  - `packages/http-fetch/test/abort-cancel.test.ts`.
  - `tests/integration/http-abort.test.ts`: four withheld requests aborted, then a fifth succeeds, through `abort()`, `config.signal` and timeout.
  - Existing abort tests in client `lib.test.ts` and React `request`/`stream` tests now abort after the opening message is sent.
- http-fetch README "Request cancellation" section; one patch changeset for both packages.

## Key design decisions

- **Cancel on the outgoing `abort` message, no `Transport.write` signature change.** Every abort path already ends in the client's `#notifyAbort`, so http-fetch can watch for it. It already branches on `typ`/`rid` for `sendSerial`. Two alternatives were rejected. An optional signal on `Transport.write` would be a public API change that every other transport ignores. A `cancel(rid)` capability would add API surface and feature detection with no gain.
- **Opt-in, non-breaking.** The client fix works for every transport; fetch cancellation is per-transport and off by default.
- **A per-rid cancel never touches the shared SSE connect**, the first stream/channel open, and never errors the transport.
- **Client dispose** does not send `abort` messages, because the write preflight throws. Its fetches are cancelled through the transport-wide signal.
- **Rid reuse is a documented constraint, not guarded.** The wire carries only the rid, so a late reply or delayed abort from an aborted call cannot be told apart from a replacement call's. JSDoc on `config.id` says not to reuse an aborted call's ID while its request may be in flight.
- **Visible behaviour changes** (in the changeset):
  - A call aborted before its message is sent never reaches the server handler.
  - Falsy params are now sent.
  - An ignored request rejection no longer raises `unhandledRejection`.
- Runtime APIs (`AbortSignal.any`, `Symbol.asyncDispose`) on RN/Expo are covered by a planned `@sozai/runtime-expo` polyfill, not by enkaku.

## Follow-on

- `docs/agents/plans/backlog/2026-10-22-otel-api-1-10-sdk-3-upgrade.md`
- Optional: `channel.send()` after the channel settles resolves silently (the write is skipped). Rejecting with a "channel closed" error would be a separate behaviour change.
