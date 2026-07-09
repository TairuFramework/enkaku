# Client / transport lifecycle hardening — design

**Date:** 2026-07-09
**Origin:** `docs/agents/plans/next/2026-07-07-client-transport-lifecycle-hardening.md`, itself derived from the 2026-07-03 repo audit (`docs/agents/plans/completed/2026-07-03-repo-audit.complete.md`, priorities 2–3).

## Problem

Nine defects in the client and transport lifecycle, all verified in source. Four crash or hang the process; five degrade correctness or resource safety under load. They cluster around three seams: the client's read loop, the transports' close/backpressure handling, and the server's auth-mode message ordering.

Two of the nine are not bug fixes but design changes with observable behavior:

- **Event write failures.** `client.sendEvent()` resolves successfully even when the transport write fails. Over http-fetch a non-2xx response for a rid-less message produces no signal at all.
- **Backpressure.** Neither the socket transport nor the http-serve SSE feed bounds its queues. A fast producer with a slow consumer grows memory without limit.

Packages affected: `transport`, `client`, `socket`, `http-serve`, `http-fetch`, `server`. All are at 0.18.1 (pre-1.0).

## Decisions

| Question | Decision | Why |
|---|---|---|
| Scope | All nine findings | Two mediums touch the same lines as the highs; splitting means two passes over the same code. |
| Failed event write | `sendEvent` rejects | `Promise<void>` already implies rejection. Callers already `await`. A silent-by-default failure is what the audit flagged. |
| SSE slow consumer | Bounded buffer, drop the session | The bridge's writable sink is shared by every session; awaiting one session's `desiredSize` head-of-line-blocks all the others. |
| Auth-mode ordering race | Per-rid pending map | Preserves cross-rid concurrency. Awaiting `process()` would serialize every `verifyToken` behind the previous message. |
| HTTP disconnect abort | Transport-level `requestAborted` event | The bridge cannot sign a synthetic `abort` message, and `requireAuth` rejects unsigned aborts. A transport-emitted event is trusted because it cannot arrive over the wire. |

## Approach

Dependency-ordered phases on a single branch (`transport-lifecycle-hardening`), each a commit, each test-driven. Phase 1 lands the shared primitive that phase 2's http-serve work depends on. The phase boundaries are the real dependency edges.

Rejected: splitting by package (`requestAborted` and `sendEvent`-rejects both straddle package boundaries, so the branches would block on each other); splitting by severity (`sendEvent` rejects is a medium but shares code with the http-fetch changes).

---

## Phase 1 — client core (`packages/client`, `packages/transport`)

### Prototype pollution and read-loop death

`packages/client/src/client.ts:275,278`. `#controllers` and `#spans` are plain `{}`. A server message with `rid: "__proto__"` returns `Object.prototype`, which passes the `controller == null` check at line 415; `controller.error` is `undefined`, so the `'error'` case throws a `TypeError` inside the floating `#read()` promise. The loop dies, every current and future request hangs silently, and the rejection is unhandled.

Both maps become `Object.create(null)`, matching the server (`packages/server/src/server.ts:108`). Independently, the `switch` on `msg.payload.typ` is wrapped in `try/catch`: a throw logs at `warn` and `continue`s. `Object.create(null)` closes the known vector; the `try/catch` closes the class.

### Graceful remote close hangs the client

`packages/client/src/client.ts:387-389`. `#read()` returns silently when `next.done`. Nothing disposes the transport when its readable ends, so `transport.disposed` never resolves and the `#setupTransport` handler (line 327) never fires. Controllers are never aborted; `handleTransportDisposed` never runs, so reconnect never happens. A clean socket close leaves in-flight requests hanging forever.

The `done` branch calls `void this.#transport.dispose()`, guarded by `if (!this.signal.aborted)` so a client-initiated dispose does not re-enter. Disposing the transport resolves `transport.disposed`, which drives the existing handler. This reuses the established path rather than duplicating its logic inside `#read`.

### `sendEvent` rejects on write failure

`packages/client/src/safe-write.ts:31-48`. Rule after the change:

1. Benign teardown while aborting → `writeDropped` event, return. (Unchanged.)
2. Otherwise → `writeFailed` event, `onFailure?.(error)`, then **rethrow if `rid == null`**.

Rid-bearing writes keep resolving: their failure already reaches the caller because `#write`'s `onFailure` aborts `#controllers[rid]`, so the awaited request/stream/channel promise rejects there. Rid-less writes have no controller, so the throw is their only channel.

`#notifyAbort` (client.ts:503) passes a `rid`, so it never hits the rethrow path; its existing `try/catch` → `requestError` behavior is untouched.

### `TransportEvents.requestAborted`

`packages/transport/src/index.ts:21-26`. Add:

```ts
requestAborted: { rid: string; reason?: unknown }
```

Declared here, emitted by http-serve (phase 2), consumed by `serve()` (phase 3). Nothing else in this phase touches it.

---

## Phase 2 — transports (`packages/socket`, `packages/http-serve`, `packages/http-fetch`)

### socket: write-after-close crashes the process

`packages/socket/src/index.ts:78-98`. `detach()` removes the socket's only `'error'` listener once the readable settles, but `writable`'s sink still calls `socket.write()`. A write on the destroyed socket emits `'error'` with zero listeners → uncaught exception.

A dedicated no-op `'error'` listener is attached once at stream creation and never removed. That alone prevents the zero-listener crash. `detach()` keeps removing `onData`/`onClose`/`onError` as today. A `socketError: Error | null` cell records the last error; the writable sink checks `socket.destroyed || socketError != null` and throws, so a write-after-close surfaces as `writeFailed` rather than killing the process.

### socket: backpressure

`packages/socket/src/index.ts:50-56,89-92`. `onData` enqueues unconditionally; the sink ignores `socket.write()`'s return value.

Readable becomes `new ReadableStream<Uint8Array>({ start, pull }, new ByteLengthQueuingStrategy({ highWaterMark }))`. `onData` enqueues, then calls `socket.pause()` when `controller.desiredSize <= 0`; `pull()` calls `socket.resume()`.

The writable sink becomes async: when `socket.write(...)` returns `false`, it awaits `'drain'`, raced against `'close'` and `'error'` so a socket dying mid-wait rejects the write instead of hanging it. `writeTo`'s `write` is an `UnderlyingSinkWriteCallback`, so returning a promise makes `WritableStream` apply backpressure to the caller for free.

`highWaterMark` is a new option on `SocketTransportParams`, defaulting to 1 MiB.

### http-serve: SSE bounded buffer

`packages/http-serve/src/index.ts:192,330`. `session.controller.enqueue()` runs inside the bridge's single writable sink, shared by every session. Awaiting one session's `desiredSize` there would block all the others.

The SSE body stops using `createReadable` and becomes:

```ts
new ReadableStream<string>({ start }, {
  highWaterMark: maxSessionBufferBytes,
  size: (chunk) => chunk.length,
})
```

The stream's own queuing accounting then makes `sseController.desiredSize` a live byte budget, decremented on enqueue and restored as chunks are pulled — no manual counter. After an enqueue, `desiredSize <= 0` means overflow: close the controller, `sessions.delete(sessionID)`, `clearSessionInflight(sessionID)`, emit `writeFailed`. One slow consumer dies alone.

New `ServerBridgeOptions`/`ServerTransportOptions` field `maxSessionBufferBytes`, default 1 MiB.

`chunk.length` counts UTF-16 code units, not the bytes the downstream `TextEncoderStream` will emit. This is a deliberate approximation: it is proportional to the real size, cheap, and the bound is a safety limit rather than an accounting guarantee.

### http-serve: active SSE streams killed despite live traffic

`packages/http-serve/src/index.ts:133-149`. `session.lastAccess` is refreshed only by inbound POSTs (line 319), never by outbound SSE writes, so a passive stream consumer is cut off at the 5-minute default.

`lastAccess` is refreshed after a successful `session.controller.enqueue` in the writable sink.

### http-serve: rid reuse

`packages/http-serve/src/index.ts:281,320,343`. `inflight.set(rid, ...)` is unconditional, so a reused rid within the window hijacks or hangs a response.

The `request`, `channel`, and `stream` cases check `inflight.has(rid)` before `inflight.set` and return `409` with `{ error: 'Duplicate request ID' }`. `abort`/`event`/`send` do not touch `inflight` and are unaffected.

### http-serve: client disconnect never aborts the handler

`packages/http-serve/src/index.ts:155-204,335-341`. Only the SSE path listens for `request.signal` abort; a disconnected `request` client leaves its handler computing until `controllerTimeoutMs`.

The `request` case gains a `request.signal` abort listener that clears the inflight entry and its timer, resolves the deferred `Response` (with a `499` — the client is gone, but leaving the promise pending would leak it), then emits `requestAborted { rid, reason: 'ClientDisconnected' }`. `clearSessionInflight` collects the rids it drops and emits one `requestAborted` each, so session timeout, buffer overflow, and SSE disconnect all abort their handlers too.

`createServerBridge` takes a new `onRequestAborted` option; `ServerTransport` wires it to `this.events.emit('requestAborted', ...)`, mirroring the existing `onWriteError` → `writeFailed` wiring.

### http-fetch: event write failures produce no signal

`packages/http-fetch/src/index.ts:244-266,315-317`. Two layers swallow the failure:

1. `sendClientMessage` returns early on `!res.ok` when the message has no rid.
2. The writable sink catches everything and calls `controller.error(...)` **without rethrowing**, so the sink resolves and `transport.write()` reports success.

Both change. `sendClientMessage` throws `new ResponseError(res)` on non-2xx when `rid == null`; rid-bearing messages keep enqueueing their synthetic per-rid error reply. The sink's `catch` splits by type:

- `ResponseError` → rethrow **without** `controller.error`. The server answered and the transport is alive; one bad event must not tear down the connection.
- Anything else → today's `controller.error(...)`, and now also rethrow.

Combined with phase 1's `safeWrite`, `await client.sendEvent(...)` rejects.

---

## Phase 3 — server (`packages/server`)

### Auth-mode channel-open / send ordering race

`packages/server/src/server.ts:466-486` vs `487+`. `process` is synchronous when `requireAuth` is false and async when it is true. The `channel`/`stream`/`request` cases call it un-awaited (lines 712, 722, 808), while `send`/`abort` await `verifyToken` inline before their `controllers[rid]` lookup. A `send` arriving right behind its channel open can win the race and be dropped as "unknown channel".

Non-auth mode has no race: `handleChannel` (`packages/server/src/handlers/channel.ts:64`) registers `ctx.controllers[rid]` synchronously before any await, so `process` → `processHandler` → `handle()` completes registration before `handleNext()` recurses.

Add `const pending: Record<string, Promise<void>> = Object.create(null)` beside the existing `running` registry (server.ts:117). The `handleNext` switch registers the promise synchronously:

```ts
case 'channel': {
  const message = msg as ChannelMessageOf<Protocol>
  track(message.payload.rid, process(message, () => handleChannel(context, message)))
  break
}
```

`track(rid, result)` is a no-op when `result` is not a promise (non-auth mode's `process` returns `void`); otherwise it sets `pending[rid]` and clears it in a `finally`. The promise resolves once `process` has run `processHandler`, which invokes `handle()` and has therefore registered the controller.

`send` and `abort` then `await pending[msg.payload.rid]` immediately before their `controllers[rid]` lookup — after their own signature and replay checks, so a forged `send` cannot make the server wait on anything. If the channel's auth failed, `pending` still resolves, no controller was registered, and `send` takes the existing "unknown channel" path (server.ts:775-778). Concurrency across distinct rids is untouched.

### `requestAborted` subscription

`handleMessages` subscribes `transport.events.on('requestAborted', ({ rid, reason }) => …)`, which aborts `controllers[rid]`, emits `handlerAbort`, and performs the same bookkeeping as the timeout sweep: `limiter.removeController(rid)`, `limiter.releaseHandler()`, `delete controllers[rid]`, `delete running[rid]`.

That bookkeeping now has three call sites (timeout sweep at server.ts:137-152, the `abort` message case, dispose). This phase extracts it into one `abortController(rid, reason)` helper the callers share. That is the targeted improvement this work justifies; no broader refactor.

The event is trusted precisely because it cannot arrive over the wire — `TransportEvents` is an in-process `EventEmitter`, so only a transport implementation can emit it.

---

## Testing

Each fix gets a failing test before its implementation. Notes on the awkward ones:

- **Prototype pollution.** Feed a `DirectTransports` server message with `rid: "__proto__"`, then assert a subsequent normal request still resolves. Without the fix this hangs, so the assertion needs a timeout, not a bare `await`.
- **Graceful close.** Close the server side of a `DirectTransports` pair; assert in-flight requests reject and `handleTransportDisposed` was called.
- **Socket write-after-close.** Capture `process.on('uncaughtException')`, or the test passes vacuously. Assert the sink rejects.
- **SSE overflow.** Build a bridge with a small `maxSessionBufferBytes`, never read the response body, write until the session drops. Assert `writeFailed` fired and the session id is gone from `sessions`.
- **Auth race.** Needs the channel's `verifyToken` to be slow enough to lose to the `send`. A fake resolver holding a per-DID deferred is the lever — deterministic, no timers.
- **Backpressure.** Assert `desiredSize` and `socket.pause()`/`resume()` transitions rather than trying to observe memory.

## Public surface changes

- `TransportEvents` gains `requestAborted: { rid: string; reason?: unknown }`.
- `ServerBridgeOptions` and `ServerTransportOptions` gain `maxSessionBufferBytes?: number` (default 1 MiB).
- `createServerBridge` gains `onRequestAborted?: (event: TransportEvents['requestAborted']) => void`.
- `SocketTransportParams` gains `highWaterMark?: number` (default 1 MiB).
- `client.sendEvent()` now rejects when the transport write fails for a non-teardown reason. **Behavior change.**
- http-serve returns `409` for a duplicate in-flight rid. **Behavior change.**
- An http-serve SSE session whose buffer overflows is now closed. **Behavior change.**

Changesets: patch for the fixes, minor for the packages gaining options or changing behavior.

## Out of scope

- The stale pre-split documentation cleanup (`docs/agents/plans/next/2026-07-07-stale-docs-cleanup.md`).
- Any transport other than `socket`, `http-serve`, `http-fetch` emitting `requestAborted`. The event is declared for all; only http-serve emits it here.
- Backpressure for `message-port`, `node-streams`, or Electron IPC transports.
