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

`dispose(reason = 'Dispose'): Promise<void>` is idempotent — a private `#disposed` flag/promise makes repeat calls return the same settled promise.

**Settlement is controller-owned, not map-derived.** `createController`'s internal `done` flag is exposed as a one-shot read-only `controller.settled: boolean` (set true inside `finish()`). `dispose()` keys its "already done" decision off `controller.settled`, **never** off `#controllers[rid]` membership — the two are different facts: a controller can be pending yet absent from the map (its rid slot was overwritten by a reused explicit `id`, or it was never registered — the pre-aborted branch), and a controller can be settled. Using map membership to infer settlement (the previous draft's bug) would let `dispose()` wrongly no-op on a still-pending overwritten controller and leak its promise + receive stream.

**Ownership of stream closure:** the controller's `onDone` hook is the *single owner* of the receive-writer close, and it is the place the close is absorbed. Both stream/channel controller construction sites change from `() => writer.close()` to `() => void writer.close().catch(() => {})`, so the one close can never leak an unhandled rejection (e.g. writer already errored by an in-flight `#read()` write). `dispose()` **never** closes the writer itself — it only settles the controller, which runs `onDone` exactly once.

This algorithm covers the **normal branch** (a registered controller with `#handleSignal`'s abort listener installed). The pre-aborted branch is handled separately at creation — see Wiring.

1. If `#disposed` already set → return the stored promise. Set `#disposed`.
2. If `!controller.settled`: settle it via `controller.abort(reason)` (benign `'Dispose'`). Because `#handleSignal` installed the abort listener for a normal call, this runs that path once — best-effort server `abort` notify (fire-and-forget), `controller.aborted` → `finish()` (sets `settled`) → `onDone` closes the receive writer once (absorbed) → rejects `controller.result` (absorbed by Piece 1, and by `#endSpanOnResult`).
3. **Identity-checked map removal** (separate from settlement): `if (this.#controllers[rid] === controller) delete this.#controllers[rid]`. Never unconditional, so a reused explicit `id` whose slot now holds a *newer* controller is not clobbered. (For an already-removed controller this is a no-op.)
4. **Channel send side:** mark disposed so `send()` rejects — see below.
5. **Resolve** `Promise<void>` when *local* teardown is done (controller settled, receive close initiated). It does **not** await the server `abort` ack (`#notifyAbort` is fire-and-forget; there is no ack).

**Post-dispose sends (channel) — narrowed guarantee.** After `dispose()`, a `send(value)` **begun after** disposal rejects with the dispose reason before touching the transport (the `send` closure checks the `#disposed` flag first), and `writable` — whose sink is that `send` closure — errors on its next write, so no *new* `send` reaches a dead rid. A `send()` **already in flight** when `dispose()` runs (e.g. parked awaiting token signing inside `#write`) is *not* forcibly cancelled and may still complete; disposal is not a send barrier. This is the intended, documented boundary (Sakui does not send after dispose). `writable` is not actively `close()`d — the flag causes its next write to reject and error the stream.

**Already-settled interaction.** The claim "a consumer awaiting a disposed call observes a rejection" holds **only when `dispose()` settles the controller** (step 2 ran). If a server result/error already settled it (`controller.settled` true), `await call` yields that result/error and `dispose()` skips step 2 — a clean no-op that still resolves and still runs the identity-checked map cleanup. The linearization point is the controller's one-shot `finish()`: whichever of {result, error, external abort, dispose-abort} runs first wins; the rest are no-ops.

### Wiring

`createStream`/`createChannel` are free functions built by the client; `dispose` needs the held `controller` (which carries `settled`), `rid`, the `#disposed` flag, `this.#controllers`, and (channel) the send-side disposed flag. The client threads a `dispose` closure into the call the way it already threads `signal`, and attaches the Piece 1 absorb to the assembled call object in **both** branches.

**Pre-aborted branch (separate handling).** The `providedSignal?.aborted` early returns build the controller *before* `#handleSignal` runs, so their controller has no abort listener — routing dispose through `controller.abort()` there would settle nothing and would reject the unwatched `controller.result` (an unhandled rejection). Instead, the pre-aborted branch **closes its receive writer at creation** — `void writer.close().catch(() => {})` — so `readable` ends immediately, and wires the returned call's `dispose()` to a resolved no-op (its resources were torn down at construction; `controller.result` is left pending and unreferenced, which is harmless — nothing rejects it, and the outer call promise rejects via the already-rejected `sent`, covered by the Piece 1 absorb). The channel pre-aborted branch keeps its existing no-op `send`.

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

## Targeted improvement — identity-checked controller-rid mutations

Needed so the disposal identity-check is not undone by *other* paths mutating the same rid slot, and closing a pre-existing latent hazard around reused explicit `id`s. Two controller-originated `#controllers[rid]` mutations fire **asynchronously**, after the slot may have been reused by a newer call sharing the rid:

- `#handleSignal`'s abort listener ends with `delete this.#controllers[rid]` (unconditional). If a stale (overwritten) controller's external/provided signal aborts later, it deletes the *newer* controller.
- `#write`'s `onFailure` does `this.#controllers[rid]?.abort(error)` — a **map lookup at failure time**, which after id reuse resolves to the *newer* controller. Capturing `this.#controllers[rid]` inside `#write` does not help: it still reads the map. The owning controller must be **passed in explicitly**.

Fixes:

```ts
// #handleSignal onAbort — identity-checked delete (controller is in scope):
if (this.#controllers[rid] === controller) delete this.#controllers[rid]

// #write gains an optional owning-controller param, threaded from every
// rid-bearing write site (request, stream/channel open, channel send(),
// #notifyAbort). onFailure aborts THAT controller directly — abort() is
// one-shot, so aborting an already-settled owner is a no-op, and a stale
// owner is aborted instead of the newer occupant of its rid:
async #write(payload, header?, rid?, owner?: AnyClientController) { /* ... */
  onFailure: (error) => { owner?.abort(error) }   // was this.#controllers[rid]?.abort(error)
}
```

Threading the owner (rather than a map lookup or an identity guard) is what makes `send()` correct: a channel `send()` begun after its rid was reused still fails onto *its own* controller, never the replacement. The synchronous result/error deletes in `#read()` (they fetch the current controller for that rid and act on it in the same tick) are already safe and unchanged. This hardening is only observable when callers pass and reuse explicit `id`s; with default random rids it is inert, but it makes the disposal guarantees hold unconditionally.

### `controller.settled` accessor

`createController` exposes a one-shot read-only `settled: boolean` that reflects the existing internal `done` flag `finish()` already sets. **It must not be a getter placed in the `Object.assign` source object** — `Object.assign` copies a getter's *value* (a snapshot of `false`), not the accessor. Define it directly on the built controller instead:

```ts
const controller = Object.assign(new AbortController(), params, { result, ok, error, aborted })
Object.defineProperty(controller, 'settled', { get: () => done, enumerable: false })
return controller
```

Because the stream/channel wrapper mutates this same object in place (`Object.assign(createController(...), { receive: writer })` — `createController(...)` is the target arg), the defined accessor is retained. `settled` is the single source of truth for "reached a terminal state," consumed by `dispose()` and available to tests. No behavior change to `ok`/`error`/`aborted`. The `RequestController` type gains `readonly settled: boolean`.

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

createController: onDone = () => void writer.close().catch(() => {})  // single close owner, absorbed
                 defineProperty(controller,'settled',{ get:()=>done })

NORMAL createStream/createChannel:
  build call; void call.catch(() => {})   // no unhandled rejection, awaiters unaffected
  dispose(reason='Dispose'):  // idempotent via #disposed
    if #disposed: return stored promise ; set #disposed
    if !controller.settled:                 // keyed off CONTROLLER, not the map
        controller.abort(reason)
            -> #handleSignal onAbort -> notify server (fire-and-forget),
               finish() sets settled, onDone closes receive writer ONCE (absorbed),
               reject controller.result [absorbed]
    if #controllers[rid] === controller: delete   // identity-checked, separate
    channel: mark disposed -> later send()/writable writes reject (no send for dead rid)
    -> resolve Promise<void> when LOCAL teardown done (no server ack awaited)

PRE-ABORTED createStream/createChannel (providedSignal already aborted):
  void writer.close().catch(() => {})     // readable ends at creation
  build call; void call.catch(() => {})   // absorbs the rejected sent
  dispose = () => Promise.resolve()        // resolved no-op; resources already gone

#write(payload, header?, rid?, owner?):    // owner threaded from every rid write site
  onFailure: (error) => owner?.abort(error)   // one-shot; never the reused-rid occupant
```

## Error handling

- Timeout rejects the call with `RequestTimeoutError` (a `RequestError`, so existing `instanceof RequestError` catches still fire); `.code === 'RequestTimeout'` and `.data.procedure` / `.data.timeoutMs` are available. The server-side `abort` notification carries the reason string `'RequestTimeoutError'` (via the explicit `name`).
- A disposed stream/channel never emits an unhandled rejection. An explicit `await` on a disposed call rejects with the dispose reason **only when `dispose()` won the race**; if a server result/error already settled the call, the awaiter sees that instead (see Feature 2 "Already-settled interaction").
- **Concurrent inbound write during dispose:** `#read()` may already be mid-`receive.write()` when `dispose()` settles the controller (which runs `onDone` → `writer.close()`). `#read()` already `.catch(() => {})`es its writes, and the single owned `writer.close()` is now `.catch`-absorbed at its `onDone` site, so neither races into an unhandled rejection. Data already queued in the pipe when `dispose()` runs is not guaranteed to drain — disposal is a teardown, not a flush.
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
- **When `dispose()` settles the call** (`controller.settled` was false), a consumer awaiting it observes the rejection (the absorb does not hide it).
- **When a result settled first** (`controller.settled` true), `dispose()` skips the abort — still resolves, still runs the identity-checked map cleanup — and an awaiter sees the *result*, not a dispose rejection.
- **Settlement is not inferred from the map:** an overwritten-but-still-pending controller (reused explicit `id`) is disposed correctly — its receive writer is closed — rather than wrongly treated as settled.
- **Channel post-dispose send:** a `send()` begun after `dispose()` rejects and `writable`'s next write rejects — no new `send` for the dead rid. (A send already in flight may still complete — documented boundary.)
- **Identity-checked removal:** disposing an old call whose explicit `id` was reused by a newer live call does not delete the newer controller; likewise a late external-signal abort or write failure on the stale rid does not delete/abort the newer controller (identity-checked `#handleSignal` / `#write` paths).
- **Single close owner:** the receive writer is closed exactly once via `onDone`, `dispose()` never closes it itself, and a benign close rejection is absorbed (no `unhandledrejection`).
- Double `dispose()` is idempotent (second call returns the same resolved promise; no duplicate server notify).
- **Pre-aborted branch:** a stream/channel created with an already-aborted `signal` produces no unhandled rejection, its `readable` ends immediately (writer closed at creation), and `dispose()` on it is a resolved no-op.

**Controller-identity hardening (explicit-id reuse):**
- A late abort of an old call's provided signal, after its explicit `id` was reused by a newer live call, does not delete the newer controller from the map (the newer call still receives its reply).
- A late `#write` failure for an old send does not abort the newer controller sharing that rid.
- `dispose()` on an overwritten-but-still-pending controller closes *its* receive writer and does not delete the newer controller's map entry.

## Non-goals / YAGNI

- No timeout on streams/channels (long-lived by design).
- No change to the `Result` type or to `abort()` / `close()` semantics.
- `AbortSignal.timeout` is not used (chose `setTimeout`/`clearTimeout` for fake-timer testability).
- No new client-wide teardown API beyond `dispose()` on the call.
- `dispose()` does not flush queued receive data or await a server acknowledgement — it is a teardown, not a graceful drain.
- `dispose()` does not cancel a `send()` already in flight (parked inside `#write`); it only rejects sends begun after disposal. It is a send barrier for *new* sends, not an interrupt.

## Acceptance

`sakui/packages/runtime-client/src/client.ts`:
- drops `#withTimeout` and all per-method `label`/`signal` plumbing; each method becomes a direct `this.#client.request(procedure, { param })`, relying on a `requestTimeoutMs` client default;
- the `getSpaceGraphContext` channel factory's `dispose` collapses to a single `await channel.dispose()`, with the rejection-absorbing `channel.then(...)` handler and its explanatory comment block removed.
