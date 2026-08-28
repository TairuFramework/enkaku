# `@enkaku/react` async hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two client-agnostic React hooks to `@enkaku/react` — `useCall` (async data) and `useAsyncResource` (async disposable resource) — that own the run/cancel/dispose lifecycle so consumers stop hand-rolling `useEffect` machinery.

**Architecture:** A single non-exported engine hook (`useAsyncState`) drives a generation-guarded state machine: it runs a caller-supplied async function on mount and on `deps` change, tags each run with a generation counter, ignores results from superseded runs, bumps the generation on cleanup (covering unmount and StrictMode), and passes an `AbortSignal` per run. `useCall` is a thin wrapper mapping the engine's value to `data`. `useAsyncResource` reuses the same engine, adding an `onDiscard` callback that disposes any resolved resource that is not the current live one (late arrivals and the previous resource before re-open) via `[Symbol.asyncDispose]`/`[Symbol.dispose]`. The hooks never touch `ReactClient`, `EnkakuContext`, or `EnkakuProvider`.

**Tech Stack:** TypeScript, React 19 (`react` catalog), vitest + happy-dom, `@testing-library/react` (`renderHook`, `act`, `waitFor`). Build via swc; types via tsc.

**Spec:** `docs/superpowers/specs/2026-08-28-react-async-hooks-design.md` — read it alongside this plan.

## Global Constraints

Copied verbatim from the spec and repo conventions (AGENTS.md). Every task's requirements implicitly include this section.

- Use `type`, never `interface`.
- No lowercase abbreviations in names: `ID`, `HTTP`, `JWT` — not `Id`/`Http`/`Jwt`.
- Use `Array<T>`, never `T[]`.
- No `any` — use `unknown`, `Record<string, unknown>`, or a specific type.
- Use `pnpm`/`pnpx`, never `npm`/`npx`.
- Do not edit generated files (`lib/`, `*.gen.ts`).
- Hooks are client-agnostic: no dependency on `ReactClient`, `EnkakuContext`, `EnkakuProvider`, `@enkaku/client`, or `@enkaku/protocol`.
- `error` is always coerced to `Error`: `e instanceof Error ? e : new Error(String(e))`.
- Return shape for both hooks: `{ <value>, error, loading }` where exactly one of `<value>`/`error` is non-null for the current generation, or both null while `loading`.
- Run/lint via `rtk proxy pnpm run <script>` in this repo (a shim redirects bare `pnpm run lint`). For lint use `pnpm exec biome check` directly if unsure.
- Run tests from `packages/react` with `pnpm run test:unit` (vitest) and `pnpm run test:types` (tsc).

---

## File Structure

- **Create** `packages/react/src/async.ts` — `useAsyncState` (internal engine), `useCall`, `useAsyncResource`, plus internal `coerceError` and `disposeResource` helpers. One file, one responsibility: the non-Suspense async-lifecycle family.
- **Modify** `packages/react/src/index.ts` — export `useCall` and `useAsyncResource`.
- **Create** `packages/react/test/async.test.tsx` — unit tests for both hooks.

---

### Task 1: Engine + `useCall`

Build the shared generation-guarded engine and the `useCall` wrapper. Deliverable: `useCall` works and is exported; the engine is exercised through it.

**Files:**
- Create: `packages/react/src/async.ts`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/test/async.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks. React (`useEffect`, `useRef`, `useState`), `DependencyList` type.
- Produces (Task 2 relies on these exact names/signatures):
  - `coerceError(e: unknown): Error`
  - `type AsyncState<V> = { value: V | null; error: Error | null; loading: boolean }`
  - `useAsyncState<V>(run: (signal: AbortSignal) => Promise<V>, deps: DependencyList, onDiscard?: (value: V) => void): AsyncState<V>` — non-exported engine. Calls `onDiscard(value)` for every resolved value whose generation is superseded (late arrival) and for the current stored value on cleanup.
  - `useCall<R>(run: (signal: AbortSignal) => Promise<R>, deps: DependencyList): { data: R | null; error: Error | null; loading: boolean }`

- [ ] **Step 1: Write the failing tests for `useCall`**

Create `packages/react/test/async.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type PropsWithChildren } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { useCall } from '../src/index.js'

/** A promise plus its resolve/reject, for driving hook timing from the test. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useCall', () => {
  test('resolves to data and clears loading', async () => {
    const { promise, resolve } = deferred<number>()
    const { result } = renderHook(() => useCall(() => promise, []))

    expect(result.current).toEqual({ data: null, error: null, loading: true })

    await act(async () => {
      resolve(42)
      await promise
    })

    expect(result.current).toEqual({ data: 42, error: null, loading: false })
  })

  test('coerces a rejection to Error', async () => {
    const { promise, reject } = deferred<number>()
    const { result } = renderHook(() => useCall(() => promise, []))

    await act(async () => {
      reject('boom')
      await promise.catch(() => {})
    })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('boom')
  })

  test('coerces a synchronous throw to Error', async () => {
    const { result } = renderHook(() =>
      useCall(() => {
        throw new Error('sync fail')
      }, []),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('sync fail')
    expect(result.current.data).toBeNull()
  })

  test('re-runs when deps change and clears prior data first', async () => {
    let current = deferred<string>()
    const runs: Array<number> = []
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) =>
        useCall(() => {
          runs.push(key)
          return current.promise
        }, [key]),
      { initialProps: { key: 1 } },
    )

    await act(async () => {
      current.resolve('one')
      await current.promise
    })
    expect(result.current.data).toBe('one')

    current = deferred<string>()
    rerender({ key: 2 })
    // Prior data cleared while the new run is in flight.
    expect(result.current).toEqual({ data: null, error: null, loading: true })

    await act(async () => {
      current.resolve('two')
      await current.promise
    })
    expect(result.current.data).toBe('two')
    expect(runs).toEqual([1, 2])
  })

  test('ignores a superseded resolution (A then B, A resolves late)', async () => {
    const a = deferred<string>()
    const b = deferred<string>()
    let next = a
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useCall(() => next.promise, [key]),
      { initialProps: { key: 1 } },
    )

    next = b
    rerender({ key: 2 })

    await act(async () => {
      b.resolve('B')
      await b.promise
    })
    expect(result.current.data).toBe('B')

    // A resolves after it was superseded — must be ignored.
    await act(async () => {
      a.resolve('A')
      await a.promise
    })
    expect(result.current.data).toBe('B')
  })

  test('aborts the run signal on unmount', async () => {
    const { promise } = deferred<number>()
    let captured: AbortSignal | undefined
    const { unmount } = renderHook(() =>
      useCall((signal) => {
        captured = signal
        return promise
      }, []),
    )

    expect(captured?.aborted).toBe(false)
    unmount()
    expect(captured?.aborted).toBe(true)
  })

  test('does not set state after unmount (StrictMode safe)', async () => {
    const { promise, resolve } = deferred<number>()
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>
    const { result, unmount } = renderHook(() => useCall(() => promise, []), { wrapper })

    unmount()
    await act(async () => {
      resolve(7)
      await promise
    })
    // No throw / no act warning; final state stays loading (never updated post-unmount).
    expect(result.current.loading).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/react && pnpm exec vitest run test/async.test.tsx`
Expected: FAIL — `useCall` is not exported from `../src/index.js` (module has no export / import error).

- [ ] **Step 3: Write the engine and `useCall`**

Create `packages/react/src/async.ts`:

```ts
import { type DependencyList, useEffect, useRef, useState } from 'react'

/** Coerce any thrown/rejected value into an Error. */
export function coerceError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export type AsyncState<V> = {
  value: V | null
  error: Error | null
  loading: boolean
}

/**
 * Generation-guarded async lifecycle engine shared by useCall and
 * useAsyncResource.
 *
 * Runs `run` on mount and on every `deps` change. Each run is tagged with a
 * generation counter; a resolve/reject is applied only when its generation is
 * still current. Cleanup (unmount or before a re-run) increments the
 * generation, so an in-flight run whose promise ignores the AbortSignal is
 * still invalidated — this covers unmount and StrictMode's
 * setup/cleanup/setup cycle. Aborting the signal is a courtesy for cancellable
 * work; correctness rests on the generation guard.
 *
 * `onDiscard`, when provided, is called for every resolved value that does not
 * become (or stay) the current value: a late arrival from a superseded run,
 * and the current value at cleanup. useAsyncResource uses it to dispose
 * resources; useCall omits it.
 */
export function useAsyncState<V>(
  run: (signal: AbortSignal) => Promise<V>,
  deps: DependencyList,
  onDiscard?: (value: V) => void,
): AsyncState<V> {
  const generationRef = useRef(0)
  const currentValueRef = useRef<V | null>(null)
  const [state, setState] = useState<AsyncState<V>>({
    value: null,
    error: null,
    loading: true,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's contract, not derived here
  useEffect(() => {
    const generation = ++generationRef.current
    const controller = new AbortController()
    setState({ value: null, error: null, loading: true })

    const isCurrent = () => generation === generationRef.current

    const handleValue = (value: V) => {
      if (isCurrent()) {
        currentValueRef.current = value
        setState({ value, error: null, loading: false })
      } else {
        onDiscard?.(value)
      }
    }
    const handleError = (error: unknown) => {
      if (isCurrent()) {
        setState({ value: null, error: coerceError(error), loading: false })
      }
    }

    // Guard synchronous throws from `run` before a promise is returned.
    let promise: Promise<V>
    try {
      promise = run(controller.signal)
    } catch (error) {
      handleError(error)
      return () => {
        generationRef.current++
        controller.abort()
      }
    }
    promise.then(handleValue, handleError)

    return () => {
      generationRef.current++
      controller.abort()
      const value = currentValueRef.current
      currentValueRef.current = null
      if (value != null) {
        onDiscard?.(value)
      }
    }
  }, deps)

  return state
}

export function useCall<R>(
  run: (signal: AbortSignal) => Promise<R>,
  deps: DependencyList,
): { data: R | null; error: Error | null; loading: boolean } {
  const { value, error, loading } = useAsyncState(run, deps)
  return { data: value, error, loading }
}
```

- [ ] **Step 4: Export `useCall` from the package index**

Modify `packages/react/src/index.ts` — add after the existing exports:

```ts
export { useCall } from './async.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/react && pnpm exec vitest run test/async.test.tsx`
Expected: PASS — all `useCall` tests green.

- [ ] **Step 6: Type-check**

Run: `cd packages/react && pnpm run test:types`
Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/async.ts packages/react/src/index.ts packages/react/test/async.test.tsx
git commit -m "feat(react): add useCall async hook + generation-guarded engine"
```

---

### Task 2: `useAsyncResource`

Layer disposable-resource management onto the engine via `onDiscard`. Deliverable: `useAsyncResource` works and is exported; late/superseded/previous resources are disposed; disposal never surfaces an error.

**Files:**
- Modify: `packages/react/src/async.ts`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/test/async.test.tsx` (append a `describe('useAsyncResource')` block)

**Interfaces:**
- Consumes from Task 1: `useAsyncState`, `coerceError`, `AsyncState<V>` (all in the same file).
- Produces:
  - `disposeResource(resource: AsyncDisposable | Disposable): void` — internal; prefers `[Symbol.asyncDispose]`, falls back to `[Symbol.dispose]`; swallows synchronous throws and async rejections.
  - `useAsyncResource<R extends AsyncDisposable | Disposable>(open: (signal: AbortSignal) => Promise<R>, deps: DependencyList): { resource: R | null; error: Error | null; loading: boolean }`

- [ ] **Step 1: Write the failing tests for `useAsyncResource`**

Append to `packages/react/test/async.test.tsx` (the `deferred` helper is already defined at the top of the file):

```tsx
import { useAsyncResource } from '../src/index.js'

describe('useAsyncResource', () => {
  test('resolves to resource and clears loading', async () => {
    const resource = { [Symbol.asyncDispose]: vi.fn(async () => {}) }
    const { promise, resolve } = deferred<typeof resource>()
    const { result } = renderHook(() => useAsyncResource(() => promise, []))

    expect(result.current).toEqual({ resource: null, error: null, loading: true })
    await act(async () => {
      resolve(resource)
      await promise
    })
    expect(result.current.resource).toBe(resource)
    expect(result.current.loading).toBe(false)
    expect(resource[Symbol.asyncDispose]).not.toHaveBeenCalled()
  })

  test('disposes the current resource on unmount', async () => {
    const dispose = vi.fn(async () => {})
    const resource = { [Symbol.asyncDispose]: dispose }
    const { promise, resolve } = deferred<typeof resource>()
    const { unmount } = renderHook(() => useAsyncResource(() => promise, []))

    await act(async () => {
      resolve(resource)
      await promise
    })
    expect(dispose).not.toHaveBeenCalled()
    unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  test('disposes a late-arriving resource when unmounted before it resolves', async () => {
    const dispose = vi.fn(async () => {})
    const resource = { [Symbol.asyncDispose]: dispose }
    const { promise, resolve } = deferred<typeof resource>()
    const { result, unmount } = renderHook(() => useAsyncResource(() => promise, []))

    unmount()
    await act(async () => {
      resolve(resource)
      await promise
    })
    // Late resource disposed, never stored.
    expect(result.current.resource).toBeNull()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  test('disposes the previous resource before opening the next on deps change', async () => {
    const disposeA = vi.fn(async () => {})
    const resourceA = { [Symbol.asyncDispose]: disposeA }
    const resourceB = { [Symbol.asyncDispose]: vi.fn(async () => {}) }
    let current = deferred<{ [Symbol.asyncDispose]: () => Promise<void> }>()
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useAsyncResource(() => current.promise, [key]),
      { initialProps: { key: 1 } },
    )

    await act(async () => {
      current.resolve(resourceA)
      await current.promise
    })
    expect(result.current.resource).toBe(resourceA)

    current = deferred()
    rerender({ key: 2 })
    expect(disposeA).toHaveBeenCalledTimes(1)

    await act(async () => {
      current.resolve(resourceB)
      await current.promise
    })
    expect(result.current.resource).toBe(resourceB)
  })

  test('uses the sync [Symbol.dispose] when no async dispose is present', async () => {
    const dispose = vi.fn()
    const resource = { [Symbol.dispose]: dispose }
    const { promise, resolve } = deferred<typeof resource>()
    const { unmount } = renderHook(() => useAsyncResource(() => promise, []))

    await act(async () => {
      resolve(resource)
      await promise
    })
    unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  test('swallows a rejecting async dispose (no unhandled rejection, no visible error)', async () => {
    const resource = { [Symbol.asyncDispose]: vi.fn(async () => Promise.reject(new Error('nope'))) }
    const { promise, resolve } = deferred<typeof resource>()
    const { result, unmount } = renderHook(() => useAsyncResource(() => promise, []))

    await act(async () => {
      resolve(resource)
      await promise
    })
    expect(() => unmount()).not.toThrow()
    expect(result.current.error).toBeNull()
    // Let any microtask from the rejected dispose settle.
    await act(async () => {
      await Promise.resolve()
    })
  })

  test('swallows a synchronously throwing dispose', async () => {
    const resource = {
      [Symbol.dispose]: vi.fn(() => {
        throw new Error('sync dispose fail')
      }),
    }
    const { promise, resolve } = deferred<typeof resource>()
    const { unmount } = renderHook(() => useAsyncResource(() => promise, []))

    await act(async () => {
      resolve(resource)
      await promise
    })
    expect(() => unmount()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/react && pnpm exec vitest run test/async.test.tsx`
Expected: FAIL — `useAsyncResource` is not exported.

- [ ] **Step 3: Add `disposeResource` and `useAsyncResource`**

Append to `packages/react/src/async.ts`:

```ts
/**
 * Dispose a resource via its standard teardown symbol, fire-and-forget.
 * Prefers [Symbol.asyncDispose]; falls back to [Symbol.dispose]. A synchronous
 * throw is caught; a rejected async-dispose promise is `.catch`-swallowed (a
 * bare `void` would leave an unhandled rejection). Never throws.
 */
export function disposeResource(resource: AsyncDisposable | Disposable): void {
  try {
    const asyncDispose = (resource as AsyncDisposable)[Symbol.asyncDispose]
    if (typeof asyncDispose === 'function') {
      const result = asyncDispose.call(resource) as Promise<void> | undefined
      if (result != null && typeof result.then === 'function') {
        result.then(undefined, () => {})
      }
      return
    }
    const syncDispose = (resource as Disposable)[Symbol.dispose]
    if (typeof syncDispose === 'function') {
      syncDispose.call(resource)
    }
  } catch {
    // Disposal failures never surface to the consumer.
  }
}

export function useAsyncResource<R extends AsyncDisposable | Disposable>(
  open: (signal: AbortSignal) => Promise<R>,
  deps: DependencyList,
): { resource: R | null; error: Error | null; loading: boolean } {
  const { value, error, loading } = useAsyncState(open, deps, disposeResource)
  return { resource: value, error, loading }
}
```

- [ ] **Step 4: Export `useAsyncResource` from the package index**

Modify `packages/react/src/index.ts` — update the async export line to:

```ts
export { useAsyncResource, useCall } from './async.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/react && pnpm exec vitest run test/async.test.tsx`
Expected: PASS — all `useCall` and `useAsyncResource` tests green.

- [ ] **Step 6: Type-check the package and the test file**

Run: `cd packages/react && pnpm run test:types`
Expected: PASS. If `AsyncDisposable`/`Disposable` or `Symbol.asyncDispose` are reported as unknown, confirm the repo's TS `lib`/`target` includes `esnext.disposable` (check the root `tsconfig`); the spec assumes TC39 explicit-resource-management types are available. Do not add a polyfill — only widen `lib` if the check shows it missing.

- [ ] **Step 7: Full package test + lint**

Run: `cd packages/react && pnpm run test` then `cd /Users/paul/dev/yulsi/enkaku && pnpm exec biome check packages/react/src packages/react/test`
Expected: PASS. Fix any biome findings (e.g. import ordering) before committing.

- [ ] **Step 8: Commit**

```bash
git add packages/react/src/async.ts packages/react/src/index.ts packages/react/test/async.test.tsx
git commit -m "feat(react): add useAsyncResource hook for disposable resources"
```

---

## Self-Review

**1. Spec coverage:**
- Plain hooks, no factory → Tasks 1 & 2, no factory anywhere. ✓
- `useCall` signature + `{ data, error, loading }` → Task 1 Step 3. ✓
- `useAsyncResource` signature + `{ resource, error, loading }` → Task 2 Step 3. ✓
- Shared engine, generation guard, cleanup bumps generation → Task 1 `useAsyncState`. ✓
- AbortSignal per run, aborted on cleanup → Task 1 engine + abort test. ✓
- Atomic state transitions, run-start clears value/error → Task 1 engine + "clears prior data" test. ✓
- Error coercion (async + sync throw) → Task 1 `coerceError` + rejection/sync-throw tests. ✓
- Standard `[Symbol.asyncDispose]`/`[Symbol.dispose]` disposal → Task 2 `disposeResource` + sync-dispose test. ✓
- Dispose late/superseded/previous/current resource → Task 2 tests (late, previous-on-deps-change, current-on-unmount). ✓
- Disposal swallows sync throw + async rejection → Task 2 two swallow tests. ✓
- StrictMode safety → Task 1 StrictMode test. ✓
- Existing hooks untouched → no task modifies request/stream/event/context/client. ✓
- Acceptance (Sakui swap) → out of this repo; verified by the exported signatures matching the spec's acceptance snippets. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". All steps carry real code. ✓

**3. Type consistency:** `useAsyncState(run, deps, onDiscard?)` defined in Task 1, consumed in Task 2 with `disposeResource` as `onDiscard`. `AsyncState<V>` field `value` mapped to `data` (useCall) / `resource` (useAsyncResource) consistently. `coerceError`, `disposeResource` names stable across tasks. ✓
