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
3. **Dispose is absorb-only, no type change.** `dispose()` guarantees the call promise never surfaces as an *unhandled* rejection but does not change the `Result` type or resolve the call to a sentinel. A consumer who still `await`s a disposed call observes the rejection **only when `dispose()` wins the race** against a server result; if the call already settled, the awaiter sees that terminal state and `dispose()` is a no-op that still resolves (the controller settle is the linearization point; abort/finish are one-shot).
4. **Timer primitive is `setTimeout`/`clearTimeout`** (not `AbortSignal.timeout`), chosen so timeout tests can drive virtual time with Vitest fake timers. The timeout adds no event listener.
5. **Listener and timer lifecycle is explicit** — no dangling timer or abort listener after a request settles, on any outcome (normal result, timeout, external abort).

## Global constraints

From repo conventions (AGENTS.md); every task inherits these.

- Use `type`, never `interface`; `Array<T>` not `T[]`; no `any` (use `unknown`/specific); no lowercase abbreviations in names (`ID`, `HTTP`, `JWT`).
- Use `pnpm`; do not edit generated files (`lib/`, `*.gen.ts`).
- Lint with `rtk proxy pnpm run lint` (the `rtk` shim mis-handles bare `pnpm exec biome` / `pnpm run lint`, forcing a false exit 1). Tests: `pnpm run test` / `pnpm exec vitest` in `packages/client`.
- Additive and source-compatible: `abort()` / `close()` semantics unchanged, no field removed or retyped. Two deliberate additions with observable effects, called out where they occur: (a) `request()`'s config gains an optional `timeout` (a signature addition, not a change to existing keys); (b) a disposed stream/channel no longer emits an `unhandledRejection` on teardown (intended, but a behavior change — so "non-breaking" is claimed only in the source-compatibility sense).

## Feature 1 — per-request timeout

### API

- `ClientParams` gains `requestTimeoutMs?: number` — construction default. `undefined` means no timeout (fully backward-compatible).
- `request()`'s config object gains `timeout?: number` — per-call override.
- **Effective timeout:** if the per-call `timeout` key is present, it wins (including `0` or a negative number, which explicitly disable even when a default is set); otherwise the construction `requestTimeoutMs`.
- **Validation / normalization:** a timer is armed only for a value that is a finite number `> 0`. `undefined`, `<= 0`, `NaN`, and non-finite (`Infinity`) all mean *no timer* (no throw — an invalid/`NaN` value disables rather than erroring, matching "absent = off"). A fractional value is passed to `setTimeout` as-is (host coerces). This rule is applied once to compute the effective timeout; both `requestTimeoutMs` and per-call `timeout` go through it.

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
    this.name = 'RequestTimeoutError'
  }
}
```

`this.name` is set explicitly: `#handleSignal` reduces the abort reason it forwards to the server to `signal.reason?.name ?? signal.reason`, and `RequestError` (a plain `Error` subclass) otherwise inherits `name === 'Error'`. Setting it means the server-side `abort` notification carries `'RequestTimeoutError'` rather than a bare `'Error'`. The **local** rejection the caller observes is always the full typed instance (`instanceof RequestTimeoutError`, `.code`, `.data`); only the over-the-wire reason is a string. Exported from `index.ts` alongside `RequestError`.

`{ procedure: string; timeoutMs: number }` satisfies the `Data extends Record<string, unknown>` bound (confirmed).

## Feature 2 — leak-free `dispose()` on stream/channel calls

### API

`StreamCall` (inherited by `ChannelCall`) gains `dispose(reason?: string): Promise<void>`. `RequestCall` is unchanged (requests are short-lived; keep `abort()` only). `close()` is unchanged.

### Piece 1 — no-unhandled-rejection guarantee (creation-time)

When the client builds a stream or channel call — **including the pre-aborted early-return branch** (where `sent` is `Promise.reject(providedSignal)` and no controller is registered) — it attaches an absorbing reaction to the returned call promise:

```ts
void call.catch(() => {})
```

By promise multicast this marks the call promise *handled* — so a teardown rejection (`TransportDisposed`, an abort reason, or the pre-aborted `sent` rejection) never surfaces as an *unhandled* rejection — while a consumer who also `await`s the call still receives the rejection (both reactions run; confirmed: the outer call promise adopts `controller.result`, `#endSpanOnResult` already handles the inner `controller.result` rejection, and `sent.then(...)` handles the `sent` rejection, so no path escapes). This removes the ordering fragility that forced Sakui's `.then(absorb, absorb)`: the guarantee holds whether the transport is torn down before or after `dispose()`.

The absorb is applied only to stream/channel calls, not to `request()` calls, so ordinary request error-handling (an unobserved failed request still surfaces) is unchanged. Applying it to stream/channel teardown is the one intended behavior change noted in Global Constraints.

### Piece 2 — `dispose()` clean teardown

`dispose(reason = 'Dispose'): Promise<void>` is idempotent — a private `#disposed` flag/promise makes repeat calls return the same settled promise. Because `AbortController.abort()` and the controller's `finish()` (its `done` guard) are each **one-shot**, `dispose()` cannot double-reject or double-notify no matter how it races with a normal settle; the map delete is an additional cleanliness step, not the thing that provides idempotency.

**Ownership of stream closure:** the controller's existing `onDone` hook (`createController(..., () => writer.close())`) is the *single owner* of the receive-writer close. `dispose()` does **not** close the writer itself (doing so would double-close and the ignored second `writer.close()` promise could reject — the exact unhandled rejection this feature removes). Instead `dispose()` triggers the controller settle, which runs `onDone` → `writer.close()` exactly once; and the client wraps that single `writer.close()` in `.catch(() => {})` so a benign close rejection (writer already errored by an in-flight `#read()` write) is absorbed rather than leaked.

Steps:

1. If already disposed **or already settled** (`this.#controllers[rid] !== controller`, i.e. a result/error/abort already won the race), skip to step 4 — teardown is a no-op and the call keeps whatever terminal state it reached. `dispose()` still resolves.
2. **Identity-checked map removal:** `if (this.#controllers[rid] === controller) delete this.#controllers[rid]` — never an unconditional delete, so a reused explicit `id` whose slot now holds a *newer* controller is not clobbered. Removing this controller before any transport teardown keeps a later `#abortControllers` from finding it (belt-and-suspenders on top of the one-shot guards above).
3. **Settle locally + best-effort server notify** via `controller.abort(reason)` (benign `'Dispose'`), which runs the `#handleSignal` path once: server `abort` notify (fire-and-forget), `controller.aborted` → `onDone` closes the receive writer once (close absorbed), reject-of-`controller.result` absorbed by Piece 1. For a **channel**, also close/error the send side so post-dispose `send()` / `writable` writes reject rather than emitting a `send` for a dead rid (see below).
4. **Resolve** `Promise<void>` when *local* teardown is done — i.e. the controller is settled and the receive writer close has been initiated. It does **not** await the server `abort` acknowledgement (`#notifyAbort` is fire-and-forget; there is no ack to await). "Teardown complete" means local resources released, not a server round-trip.

**Post-dispose sends (channel).** After `dispose()`, `send(value)` rejects (and `writable` is errored/closed) so a disposed channel cannot keep emitting `send` messages for a removed rid. Implementation: `send` checks the `#disposed` flag (or the controller's aborted signal) and rejects with the dispose reason before calling `#write`.

**Already-settled interaction.** Because of step 1, the claim "a consumer awaiting a disposed call observes a rejection" holds **only when `dispose()` wins the race** against the server result. If the server result/error already settled the call, `await call` yields that result/error and `dispose()` is a clean no-op that still resolves. The linearization point is the controller settle: whichever of {result, error, external abort, dispose-abort} runs first wins; the rest are one-shot no-ops.

### Wiring

`createStream`/`createChannel` are free functions built by the client; `dispose` needs the controller, `rid`, the `#disposed` flag, and access to `this.#controllers` plus the send-side handle. The client threads a `dispose` closure into the call the same way it already threads `signal`, and attaches the Piece 1 absorb to the assembled call object (both the normal and pre-aborted branches). For the pre-aborted branch, `dispose()` has no live controller — it is a no-op that resolves, and the Piece 1 absorb covers the rejected `sent`.

`dispose()` adds no event listeners.

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

**Scope of this fix (precise):** it removes *the listener Enkaku registered* from the composite on settle. It does **not** dispose the `AbortSignal.any` composite itself, nor stop a later external `providedSignal` abort from setting `call.signal.reason` after the request is done (the composite lives as long as `providedSignal` does — that is the runtime's behavior, not ours to change). The leak being fixed is precisely "our abort handler still referenced after settle"; the test asserts our handler was removed (spy on `removeEventListener` / the handler not firing post-settle), not composite garbage-collection.

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

createChannel(...) / createStream(...)   [normal AND pre-aborted branch]
  build call; void call.catch(() => {})   // no unhandled rejection, awaiters unaffected
  dispose(reason='Dispose'):  // idempotent via #disposed; one-shot abort/finish
    if already disposed or already settled (#controllers[rid] !== controller):
        no-op teardown -> resolve
    else:
        if #controllers[rid] === controller: delete   // identity-checked
        controller.abort(reason)
            -> #handleSignal onAbort -> notify server (fire-and-forget),
               onDone closes receive writer ONCE (close absorbed),
               reject controller.result [absorbed by call.catch]
        channel: send()/writable now reject (no send for dead rid)
    -> resolve Promise<void> when LOCAL teardown done (no server ack awaited)
```

## Error handling

- Timeout rejects the call with `RequestTimeoutError` (a `RequestError`, so existing `instanceof RequestError` catches still fire); `.code === 'RequestTimeout'` and `.data.procedure` / `.data.timeoutMs` are available. The server-side `abort` notification carries the reason string `'RequestTimeoutError'` (via the explicit `name`).
- A disposed stream/channel never emits an unhandled rejection. An explicit `await` on a disposed call rejects with the dispose reason **only when `dispose()` won the race**; if a server result/error already settled the call, the awaiter sees that instead (see Feature 2 "Already-settled interaction").
- **Concurrent inbound write during dispose:** `#read()` may already be mid-`receive.write()` when `dispose()` closes the writer. `#read()` already `.catch(() => {})`es its writes, and the single owned `writer.close()` is likewise absorbed, so neither races into an unhandled rejection. Data already queued in the pipe when `dispose()` runs is not guaranteed to drain — disposal is a teardown, not a flush.
- Neither feature changes the reasons or types produced by `abort()` or `close()`.

## Testing

`packages/client/test/` (Vitest; use `vi.useFakeTimers()` for the timeout timer).

**Feature 1 — timeout:**
- Effective timeout expiry rejects the call with a `RequestTimeoutError` whose `.data.procedure` names the procedure and `.data.timeoutMs` matches; the server received an `abort` notification for the rid.
- Per-call `timeout` overrides the construction `requestTimeoutMs`.
- `timeout: 0` disables the timer even when a construction default is set (request hangs / resolves normally, never times out).
- No `requestTimeoutMs` and no per-call `timeout` → no timer armed (existing behavior). `NaN` / `Infinity` / negative also arm no timer (validation).
- A request that resolves normally before expiry clears the timer — advancing virtual time past the original deadline produces no late abort and no server-abort notification.
- The server-side `abort` notification for a timeout carries the reason `'RequestTimeoutError'` (asserts `name` propagation through `#handleSignal`).
- `createStream` / `createChannel` never auto-timeout even with `requestTimeoutMs` set.

**Feature 1 — signal composition & leaks:**
- External `signal` aborts before the timeout: rejects with the external reason; advancing past the timeout deadline no-ops.
- Timeout fires before an external abort: rejects with `RequestTimeoutError`; a subsequent external abort does not double-notify.
- After a normal settle with an external `providedSignal` still alive, the merged signal has no remaining `abort` listener (assert via `providedSignal` not retaining the handler / a spy on the merged signal).

**Feature 2 — dispose:**
- `dispose()` deletes the controller from the map, ends `readable` (receive writer closed exactly once), and resolves its `Promise<void>`.
- **No unhandled rejection** when the transport is disposed *before* `dispose()` is called, and when it is disposed *after* — both orderings (assert via an `unhandledrejection` / process listener spy that stays clean).
- **When `dispose()` wins the race** (server has not settled), a consumer awaiting the call observes the rejection (the absorb does not hide it).
- **When a result settled first**, `dispose()` is a no-op that still resolves, and an awaiter sees the *result*, not a dispose rejection (already-settled interaction).
- **Channel post-dispose send:** after `dispose()`, `send(value)` rejects and `writable` writes reject — no `send` message is written for the disposed rid.
- **Identity-checked removal:** disposing an old call whose explicit `id` has been reused by a newer live call does not delete the newer controller from the map.
- **Single close owner:** the receive writer is closed exactly once (no double-close); a benign close rejection is absorbed (no `unhandledrejection`).
- Double `dispose()` is idempotent (second call returns the same resolved promise; no duplicate server notify).
- **Pre-aborted branch:** a stream/channel created with an already-aborted `signal` produces no unhandled rejection, and `dispose()` on it resolves as a no-op.

## Non-goals / YAGNI

- No timeout on streams/channels (long-lived by design).
- No change to the `Result` type or to `abort()` / `close()` semantics.
- `AbortSignal.timeout` is not used (chose `setTimeout`/`clearTimeout` for fake-timer testability).
- No new client-wide teardown API beyond `dispose()` on the call.
- `dispose()` does not flush queued receive data or await a server acknowledgement — it is a teardown, not a graceful drain.

## Acceptance

`sakui/packages/runtime-client/src/client.ts`:
- drops `#withTimeout` and all per-method `label`/`signal` plumbing; each method becomes a direct `this.#client.request(procedure, { param })`, relying on a `requestTimeoutMs` client default;
- the `getSpaceGraphContext` channel factory's `dispose` collapses to a single `await channel.dispose()`, with the rejection-absorbing `channel.then(...)` handler and its explanatory comment block removed.
