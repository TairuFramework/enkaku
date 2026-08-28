# `@enkaku/react` async hooks — design

**Date:** 2026-08-28
**Origin:** Cross-repo request from Sakui (`docs/agents/plans/next/2026-08-28-react-custom-client-and-resource-hooks.md`). Sakui's `packages/runtime-react/src/hooks.ts` hand-rolls `useEffect`-based data hooks (`useSpaceList`, `useSpaceGraphContext`) because its app talks to the runtime through a domain wrapper (`RuntimeClient`) rather than a raw enkaku `Client`, and one call returns a disposable resource rather than a plain request. These are ergonomics `@enkaku/react` should own.

## Goal

Add two client-agnostic React hooks to `@enkaku/react` that manage the lifecycle of an async operation, decoupled from `ReactClient`/`EnkakuContext` and from enkaku procedure strings, so a domain wrapper client gets first-class hooks:

- `useCall` — run an async function, expose `{ data, error, loading }`.
- `useAsyncResource` — run an async factory returning a disposable resource, own its full lifecycle including teardown.

## Decisions

Resolved during brainstorming; these are the design, not open questions.

1. **Plain hooks, no factory.** Proposal A's `createClientHooks(useClient)` factory is dropped. The consuming app already holds its own client via its own context hook (`useRuntimeClient()`), so it closes over that client and lists it in `deps`. This removes the client generic, the factory call, and any second provider. The hooks never touch `ReactClient`, `EnkakuContext`, or `EnkakuProvider`.

2. **Standard disposable contract.** `useAsyncResource` recognizes teardown via the well-known symbols `[Symbol.asyncDispose]` / `[Symbol.dispose]` (TC39 explicit resource management). No bespoke `{ dispose() }` type is invented. Sakui's `SpaceGraphContext` already implements `[Symbol.asyncDispose]`.

3. **`useCall` runner receives an `AbortSignal`.** Symmetric with `useAsyncResource`. Runners may ignore it; those that can cancel get a cancel path.

4. **Existing hooks untouched.** The current Suspense/procedure hooks (`useRequest`, `useSendRequest`, `useCreateStream`, `useReceiveAll`, `useReceiveLatest`, `useSendEvent`) are a different paradigm (procedure string + React Suspense + ref-counted `ReactClient` cache, teardown = `call.abort()`). They are not refactored or subsumed. The new hooks are a separate, additive, non-Suspense state-machine family.

## Surface

New module `packages/react/src/async.ts`, both hooks exported from `packages/react/src/index.ts`.

```ts
function useCall<R>(
  run: (signal: AbortSignal) => Promise<R>,
  deps: DependencyList,
): { data: R | null; error: Error | null; loading: boolean }

function useAsyncResource<R extends AsyncDisposable | Disposable>(
  open: (signal: AbortSignal) => Promise<R>,
  deps: DependencyList,
): { resource: R | null; error: Error | null; loading: boolean }
```

## Internal engine

A shared non-exported helper (`useAsyncState`) drives one state machine for both hooks:

- Runs the async fn on mount and whenever `deps` change (`useEffect` keyed on `deps`).
- **Generation guard:** a ref-held counter tags each run. A resolve or reject from a superseded run is ignored. This covers the ordering race (deps change A→B, A resolves after B) as well as unmount — not only unmount.
- **AbortSignal:** a fresh `AbortController` per run; its signal is passed to the fn and aborted on unmount / before a re-run, so in-flight work can cancel.
- **State:** `{ loading, error, value }`. On start of a run: `loading = true`. On success (current generation): `value` set, `error` cleared, `loading = false`. On rejection (current generation): `error` set, `loading = false`.
- **Error coercion:** `error` is always an `Error` — `e instanceof Error ? e : new Error(String(e))`, matching Sakui's current wrapping.

`useCall` maps `value` to `data`. Superseded/unmounted results are simply dropped by the generation guard; there is nothing to dispose.

`useAsyncResource` adds one behavior over the shared engine: any resolved resource that is **not** the current live one is disposed. Concretely:

- If a run resolves but its generation is superseded (component unmounted before resolve, or `deps` changed), the late-arriving resource is disposed instead of stored — nothing leaks.
- The current resource is disposed on unmount and before re-opening for new `deps`.
- Disposal calls `[Symbol.asyncDispose]` if present, else `[Symbol.dispose]`. It is fire-and-forget from React's synchronous cleanup (`void`-ed); rejections from disposal are swallowed (Sakui's `dispose` is documented idempotent and non-throwing).

## Data flow

```
mount / deps change
  -> bump generation, new AbortController, loading=true
  -> run(signal) / open(signal)
      resolve:
        current generation?  -> store value/resource, loading=false
        superseded?          -> useCall: drop
                                useAsyncResource: dispose the resource
      reject:
        current generation?  -> store wrapped Error, loading=false
        superseded?          -> ignore
cleanup (unmount / before re-run)
  -> abort signal
  -> useAsyncResource: dispose current resource if any
```

## Error handling

- All thrown/rejected values surface through `error` as an `Error`.
- `error` and a non-null `data`/`resource` are mutually exclusive for the current generation.
- Disposal failures never surface to the consumer (idempotent, swallowed).

## Testing

vitest + React Testing Library (`renderHook`), matching the repo's existing React test setup. Cases:

- `useCall`: resolve populates `data`, clears `loading`; reject populates wrapped `error`; `deps` change re-runs; unmount before resolve drops the result (no state-after-unmount warning); superseded race (A→B→A resolves late) keeps B's result; the `AbortSignal` is aborted on unmount and on re-run.
- `useAsyncResource`: all of the above for `resource`, plus — unmount before resolve disposes the late-arriving resource; a `deps` change disposes the previous resource before opening the next; unmount disposes the current resource; a resource exposing only `[Symbol.dispose]` (sync) is disposed via that symbol.

## Non-goals / YAGNI

- No `reload()`/manual refetch (no consumer needs it).
- No result caching or sharing across components (that is the existing `ReactClient` family's job; these hooks are per-component).
- No Suspense integration.
- No `EnkakuProvider` change to accept a pre-built or custom client (moot once the hooks are context-agnostic).
- The unused `createLazyRequestHook`/`createSuspenseRequestHook` in `packages/react/src/hooks.ts` are out of scope here (not exported today; leave as-is).

## Acceptance

Sakui deletes both bespoke `useEffect` hooks in `packages/runtime-react/src/hooks.ts`:

- `useSpaceList` becomes `useCall((signal) => client.listSpaces(), [client])`, renaming `data`→`spaces` at the call site.
- `useSpaceGraphContext` becomes `useAsyncResource((signal) => client.getSpaceGraphContext({ spaceID }), [client, spaceID])`, renaming `resource`→`context`.

No hand-written cancel/dispose logic remains. Any enkaku app wrapping its client the same way gets the same reduction.
