# `@enkaku/client` request timeout + clean channel disposal — design

**Date:** 2026-08-28
**Origin:** Cross-repo request from Sakui (`docs/agents/plans/next/2026-08-28-client-request-timeout-and-clean-channel-disposal.md`). `sakui/packages/runtime-client/src/client.ts` carries two blocks of boilerplate that exist only because `@enkaku/client` lacks a request timeout and because disposing a channel leaks a `TransportDisposed` rejection from its detached read loop. Both are `@enkaku/client` lifecycle concerns.

## Goal

Two independent, additive, non-breaking features in `packages/client/src/`:

1. **Per-request timeout** on `Client.request` — a construction default and per-call override that, on expiry, aborts the in-flight request through the existing abort path and rejects with a typed, procedure-named error.
2. **Leak-free `dispose()`** on stream/channel calls — a first-class teardown that removes the controller from the client map, closes the receive stream, notifies the server, and guarantees no unhandled rejection regardless of teardown ordering, with no consumer-side ordering dance or rejection-absorbing handler.

Either ships alone. Both flow through `@enkaku/react`'s call wrappers unchanged, and Feature 2's `dispose()` is the natural teardown for the `useAsyncResource` hook.

## Decisions

Resolved during brainstorming; these are the design, not open questions.

1. **Timeout is request-only.** `requestTimeoutMs` (construction) and per-call `timeout` apply only to `request()`. `createStream`/`createChannel` never auto-timeout (they are intentionally long-lived; Sakui already exempts them).
2. **Timeout error is a subclass.** `class RequestTimeoutError extends RequestError<'RequestTimeout', { procedure: string; timeoutMs: number }>`, exported from `@enkaku/client`. Callers match `instanceof RequestTimeoutError` or `.code === 'RequestTimeout'`.
3. **Dispose is absorb-only, no type change.** `dispose()` guarantees the call promise never surfaces as an *unhandled* rejection but does not change the `Result` type or resolve the call to a sentinel. A consumer who still `await`s a disposed call observes the rejection.
4. **Timer primitive is `setTimeout`/`clearTimeout`** (not `AbortSignal.timeout`), chosen so timeout tests can drive virtual time with Vitest fake timers. The timeout adds no event listener.
5. **Listener and timer lifecycle is explicit** — no dangling timer or abort listener after a request settles, on any outcome (normal result, timeout, external abort).

## Global constraints

From repo conventions (AGENTS.md); every task inherits these.

- Use `type`, never `interface`; `Array<T>` not `T[]`; no `any` (use `unknown`/specific); no lowercase abbreviations in names (`ID`, `HTTP`, `JWT`).
- Use `pnpm`; do not edit generated files (`lib/`, `*.gen.ts`).
- Lint with `rtk proxy pnpm run lint` (the `rtk` shim mis-handles bare `pnpm exec biome` / `pnpm run lint`, forcing a false exit 1). Tests: `pnpm run test` / `pnpm exec vitest` in `packages/client`.
- Additive and non-breaking: no existing public signature changes; `close()` semantics unchanged.

## Feature 1 — per-request timeout

### API

- `ClientParams` gains `requestTimeoutMs?: number` — construction default. `undefined` means no timeout (fully backward-compatible).
- `request()`'s config object gains `timeout?: number` — per-call override.
- **Effective timeout:** if the per-call `timeout` key is present, it wins (including `0` or a negative number, which explicitly disable even when a default is set); otherwise the construction `requestTimeoutMs`. A value `<= 0` or absent means no timer is armed.

### Mechanism

In `request()`, after `sent` is initiated and the controller is registered, if the effective timeout is positive:

```ts
const timeoutTimer = setTimeout(() => {
  // Only if still in-flight: once the request settles (result / error /
  // external abort) the controller has already been deleted from the map,
  // so a late fire is a no-op — no spurious server-abort for a completed request.
  if (this.#controllers[rid] === controller) {
    controller.abort(new RequestTimeoutError(procedure, effectiveTimeout))
  }
}, effectiveTimeout)
void controller.result.then(
  () => clearTimeout(timeoutTimer),
  () => clearTimeout(timeoutTimer),
)
```

`controller.abort(reason)` reuses the existing abort path verbatim: the `#handleSignal` abort listener runs `#notifyAbort` (server notification), `controller.aborted(signal)` (rejects the call with `signal.reason` = the typed error), and `delete this.#controllers[rid]`. The timeout adds **no event listener** — it is a timer plus a settle handler that clears it.

### Relation with the external `signal`

Three abort sources compose through the existing merge in `#handleSignal`:

```ts
const signal = providedSignal
  ? AbortSignal.any([controller.signal, providedSignal])
  : controller.signal
```

The timeout aborts `controller`, whose `controller.signal` is already in that merge, so the returned `call.signal` reflects whichever source fires first, with the correct reason. Race outcomes:

- **External signal first:** listener fires → rejects with the external reason, deletes controller; the settle handler `clearTimeout`s the timer; a late timer fire hits the `this.#controllers[rid] === controller` guard (false) and no-ops.
- **Timeout first:** `controller.abort(RequestTimeoutError)` → merged signal aborts → listener rejects with `RequestTimeoutError`, deletes controller; a later external abort finds the `{ once: true }` listener already consumed — no double notify.
- **Normal result:** read loop calls `controller.ok`, deletes controller, resolves `controller.result` → settle handler clears the timer; the timeout never fires.

### Error type

`error.ts` adds:

```ts
export class RequestTimeoutError extends RequestError<'RequestTimeout', { procedure: string; timeoutMs: number }> {
  constructor(procedure: string, timeoutMs: number) {
    super({
      code: 'RequestTimeout',
      data: { procedure, timeoutMs },
      message: `Request '${procedure}' timed out after ${timeoutMs}ms`,
    })
  }
}
```

Exported from `index.ts` alongside `RequestError`.

## Feature 2 — leak-free `dispose()` on stream/channel calls

### API

`StreamCall` (inherited by `ChannelCall`) gains `dispose(reason?: string): Promise<void>`. `RequestCall` is unchanged (requests are short-lived; keep `abort()` only). `close()` is unchanged.

### Piece 1 — no-unhandled-rejection guarantee (creation-time)

When the client builds a stream or channel call, it attaches an absorbing reaction to the returned call promise:

```ts
void call.catch(() => {})
```

By promise multicast this marks the call promise *handled* — so a teardown rejection (`TransportDisposed`, an abort reason) never surfaces as an *unhandled* rejection — while a consumer who also `await`s the call still receives the rejection (both reactions run). This removes the ordering fragility that forced Sakui's `.then(absorb, absorb)`: the guarantee holds whether the transport is torn down before or after `dispose()`.

This absorb is applied only to stream/channel calls, not to `request()` calls, so ordinary request error-handling expectations are unchanged.

### Piece 2 — `dispose()` clean teardown

`dispose(reason = 'Dispose'): Promise<void>` is idempotent (guarded by a flag; repeat calls return the same settled promise) and runs in this order:

1. **Remove the controller from the map first** — `delete this.#controllers[rid]` — so a later client-wide `#abortControllers` (from transport disposal or client dispose) never re-touches or re-rejects this call. This is the ordering that Sakui currently hand-rolls.
2. **Close the receive stream** (the controller's `receive` writer), so `readable` ends cleanly.
3. **Best-effort server notify + local settle** via the controller's abort with the benign `reason` (`'Dispose'`); the rejection this produces on the call promise is already absorbed by Piece 1.
4. **Resolve** the returned `Promise<void>` when teardown completes.

`dispose()` adds no event listeners.

### Wiring

`createStream`/`createChannel` are free functions built by the client; `dispose` needs the controller, `rid`, and access to `this.#controllers` / server-notify. The client threads a `dispose` closure into the call the same way it already threads `signal`, and attaches the Piece 1 absorb to the assembled call object.

## Targeted improvement — `#handleSignal` listener cleanup

Independent of the two features but in the same code and directly serving the "don't leak listeners" concern. Today `#handleSignal` adds a `{ once: true }` abort listener to the merged signal; `once` removes it on abort, but on a **normal settle** it lingers when an external `providedSignal` outlives the request (the `AbortSignal.any` composite keeps the listener alive). Fix: name the handler and remove it on settle, so no abort listener dangles on any outcome.

```ts
const onAbort = () => { /* existing listener body */ }
signal.addEventListener('abort', onAbort, { once: true })
void controller.result.then(
  () => signal.removeEventListener('abort', onAbort),
  () => signal.removeEventListener('abort', onAbort),
)
```

`removeEventListener` on an already-`once`-fired listener is a harmless no-op.

## Data flow

```
request(procedure, { param, signal?, timeout? })
  arm timer if effective timeout > 0
  settle handler: clearTimeout + removeEventListener(onAbort)
  ── result   -> controller.ok  -> delete controller, resolve
  ── error    -> controller.error -> delete controller, reject(RequestError)
  ── timeout  -> (if still in map) controller.abort(RequestTimeoutError)
                    -> #handleSignal onAbort -> notify server, reject, delete
  ── external -> providedSignal abort
                    -> #handleSignal onAbort -> notify server, reject, delete

createChannel(...) / createStream(...)
  build call; void call.catch(() => {})   // no unhandled rejection, awaiters unaffected
  dispose(reason='Dispose'):
    delete controller (first) -> close receive -> controller.abort(reason) [absorbed]
    -> resolve Promise<void>  (idempotent)
```

## Error handling

- Timeout rejects the call with `RequestTimeoutError` (a `RequestError`, so existing `instanceof RequestError` catches still fire); `.code === 'RequestTimeout'` and `.data.procedure` / `.data.timeoutMs` are available.
- A disposed stream/channel never emits an unhandled rejection; an explicit `await` on a disposed call still rejects (with the dispose/teardown reason) for consumers who opt to observe it.
- Neither feature changes the reasons or types produced by `abort()` or `close()`.

## Testing

`packages/client/test/` (Vitest; use `vi.useFakeTimers()` for the timeout timer).

**Feature 1 — timeout:**
- Effective timeout expiry rejects the call with a `RequestTimeoutError` whose `.data.procedure` names the procedure and `.data.timeoutMs` matches; the server received an `abort` notification for the rid.
- Per-call `timeout` overrides the construction `requestTimeoutMs`.
- `timeout: 0` disables the timer even when a construction default is set (request hangs / resolves normally, never times out).
- No `requestTimeoutMs` and no per-call `timeout` → no timer armed (existing behavior).
- A request that resolves normally before expiry clears the timer — advancing virtual time past the original deadline produces no late abort and no server-abort notification.
- `createStream` / `createChannel` never auto-timeout even with `requestTimeoutMs` set.

**Feature 1 — signal composition & leaks:**
- External `signal` aborts before the timeout: rejects with the external reason; advancing past the timeout deadline no-ops.
- Timeout fires before an external abort: rejects with `RequestTimeoutError`; a subsequent external abort does not double-notify.
- After a normal settle with an external `providedSignal` still alive, the merged signal has no remaining `abort` listener (assert via `providedSignal` not retaining the handler / a spy on the merged signal).

**Feature 2 — dispose:**
- `dispose()` deletes the controller from the map, ends `readable`, and resolves its `Promise<void>`.
- **No unhandled rejection** when the transport is disposed *before* `dispose()` is called, and when it is disposed *after* — both orderings (assert via an `unhandledrejection` / process listener spy that stays clean).
- A consumer awaiting a disposed call still observes the rejection (the absorb does not hide it).
- Double `dispose()` is idempotent (second call returns the same resolved promise; no duplicate server notify).

## Non-goals / YAGNI

- No timeout on streams/channels (long-lived by design).
- No change to the `Result` type or to `abort()` / `close()` semantics.
- No cancellation of `AbortSignal.timeout` internals (not used).
- No new client-wide teardown API beyond `dispose()` on the call.

## Acceptance

`sakui/packages/runtime-client/src/client.ts`:
- drops `#withTimeout` and all per-method `label`/`signal` plumbing; each method becomes a direct `this.#client.request(procedure, { param })`, relying on a `requestTimeoutMs` client default;
- the `getSpaceGraphContext` channel factory's `dispose` collapses to a single `await channel.dispose()`, with the rejection-absorbing `channel.then(...)` handler and its explanatory comment block removed.
