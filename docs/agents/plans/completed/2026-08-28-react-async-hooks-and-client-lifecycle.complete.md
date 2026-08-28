# React async hooks + client timeout & channel disposal

**Status:** complete
**Date:** 2026-08-28
**Packages:** `@enkaku/react` (0.21.3), `@enkaku/client` (0.21.1), `@enkaku/electron` (0.21.1), `@enkaku/standalone` (0.21.1)

Two related feature efforts, both originating from cross-repo Sakui requests, implemented together on one branch. The react hooks manage async-operation and disposable-resource lifecycles; the client work gives those resources a first-class, leak-free teardown and adds a request timeout. `useAsyncResource` + the client's stream/channel `dispose()` are the two halves of the same resource-lifecycle story.

## What was built

### `@enkaku/react` — `useCall` and `useAsyncResource`

Two client-agnostic hooks (new `packages/react/src/async.ts`), decoupled from `ReactClient`/`EnkakuContext` and from enkaku procedure strings, so an app talking to the runtime through a domain wrapper client gets first-class hooks:

- `useCall(run, deps)` → `{ data, error, loading }` — runs an async function.
- `useAsyncResource(open, deps)` → `{ resource, error, loading }` — runs an async factory returning a disposable resource and owns its full lifecycle including teardown.

Both are the non-Suspense, additive counterpart to the existing procedure/Suspense hooks (`useRequest`, `useCreateStream`, …), which were left untouched.

### `@enkaku/client` — per-request timeout + leak-free `dispose()`

- **Per-request timeout on `Client.request`:** a `requestTimeoutMs` construction default and a per-call `timeout` override. On expiry the in-flight request is aborted through the existing abort path and rejects with a new exported `RequestTimeoutError` (a `RequestError` subclass, `code: 'RequestTimeout'`, `data: { procedure, timeoutMs }`). Streams and channels are never auto-timed-out (they are intentionally long-lived).
- **Leak-free `dispose(reason?)` on stream/channel calls:** aborts the call's own read loop, closes the receive stream, removes the controller from the client map, and resolves once local teardown is done — with no unhandled rejection regardless of transport-teardown ordering, and no consumer-side rejection-absorbing guard or dispose-order dance.

## Key design decisions

### React hooks

- **Plain hooks, no factory.** No `createClientHooks(useClient)` and no client generic — the consuming app closes over its own client and lists it in `deps`. `run`/`open` is intentionally not a dependency; only `deps` keys the effect (standard React exhaustive-deps contract).
- **Generation-guarded engine.** A shared non-exported `useAsyncState` drives one state machine. A ref-held counter tags each run; a resolve/reject applies only when its generation is still current. **The effect cleanup bumps the generation** (not just each run start) — this, not the AbortSignal, is what invalidates an in-flight run on unmount and covers StrictMode's setup→cleanup→setup cycle. A late resolve after unmount is always superseded: it never sets state, and for `useAsyncResource` the late resource is disposed rather than retained.
- **A fresh `AbortController` per run**, aborted on cleanup — a courtesy for cancellable work; correctness rests on the generation guard.
- **Atomic state transitions.** Run start clears `value`/`error` and sets `loading` so a `deps` change shows a loading state, never a stale value. `error` is always coerced to an `Error`; `error` and a non-null `data`/`resource` are mutually exclusive.
- **Disposal is fire-and-forget and can never throw or reject to the consumer.** A single `disposeResource` helper swallows synchronous throws (`try/catch`) and rejected async-dispose promises (`.catch(() => {})`, not a bare `void`).

**As-built deviations from the original spec, both deliberate:**
- The public signature was relaxed from `useAsyncResource<R extends AsyncDisposable | Disposable>` to `<R extends object>` (and `disposeResource(resource: object)`), so consumers are not forced to enable the `esnext.disposable` TypeScript lib just to name the hook's types.
- `disposeResource` recognizes teardown in priority order: `[Symbol.asyncDispose]`, then `[Symbol.dispose]` (TC39 explicit resource management), then a plain `dispose()` **method**. The method fallback was added so an `@enkaku/client` `StreamCall`/`ChannelCall` — which exposes `dispose()` but neither symbol — is torn down by `useAsyncResource`, wiring the two efforts together without adding a symbol to the client types.

### Client timeout & disposal

- **`controller.settled` is the single linearization point.** `createController` exposes a one-shot read-only `settled: boolean` (via `Object.defineProperty`, off the internal `done` flag — a getter placed in the `Object.assign` source would snapshot `false`). Every new controller-rid guard keys off `settled`, never off `#controllers[rid]` map membership (the two diverge under reused explicit `id`s). The one exception is the map delete, which is legitimately identity-checked (`#controllers[rid] === controller`).
- **The no-unhandled-rejection absorb is scoped to stream/channel calls only.** A creation-time `void call.catch(() => {})` on the assembled stream/channel call marks its promise handled (promise multicast) while awaiters still observe the rejection. Plain `request()` calls are deliberately **not** absorbed — an unobserved failed request still surfaces. (An early implementation attempt centralized the absorb inside the shared `createRequest`, which also silenced abandoned `request()` rejections; that was reverted to preserve this boundary.)
- **`dispose()` never closes the receive writer itself.** The controller's `onDone` hook is the single close owner and is where the close is absorbed (`() => void writer.close().catch(() => {})`); `dispose()` only settles the controller, which runs `onDone` exactly once. `dispose()` is idempotent (a cached `Promise<void>`), resolves on local teardown only (no server-ack await), and rejects post-dispose channel sends begun after disposal (a send already in flight is not cancelled — a documented boundary).
- **Timer primitive is `setTimeout`/`clearTimeout`** (not `AbortSignal.timeout`) so timeout tests drive virtual time with fake timers; the timer adds no event listener, fires only when `!controller.settled`, and is cleared on any settle via `controller.result.then(clear, clear)`.
- **`#handleSignal` hardening.** Its abort handler is named, its map delete is identity-checked, and the abort listener is removed on settle so no listener dangles when an external `providedSignal` outlives the request. `#write` threads the owning controller so a write failure aborts *that* controller (guarded by `!owner.settled`), never a reused-rid occupant.
- A clean `dispose()` is classified as an `aborted` (not `error`) lifecycle outcome in the OTel `requestEnd` span, matching `close()`.

## Versioning

Per-package manual bumps (the repo's `versioning.fixed` group is de-synced and managed by hand): `@enkaku/client` 0.21.0→0.21.1 (with `@enkaku/electron` and `@enkaku/standalone` following their client dependency), and `@enkaku/react` 0.21.3 (the async-hooks bump from earlier in the branch; the later `dispose()`-method addition ships under that same version, undocumented in its changelog).

## Follow-on (cross-repo, tracked in Sakui, not this repo)

Sakui's `packages/runtime-react/src/hooks.ts` can delete its bespoke `useEffect` data hooks in favor of `useCall`/`useAsyncResource`, and `packages/runtime-client/src/client.ts` can drop its `#withTimeout` helper (using a `requestTimeoutMs` client default) and collapse the channel-factory `dispose` to a single `await channel.dispose()` with no rejection-absorbing handler. These land once 0.21.1 is published.
