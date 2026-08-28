import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useAsyncResource, useCall } from '../src/index.js'

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

  test('aborts the run signal on deps change (re-run)', async () => {
    const { promise } = deferred<number>()
    const signals: Array<AbortSignal> = []
    const { rerender } = renderHook(
      ({ key }: { key: number }) =>
        useCall(
          (signal) => {
            signals.push(signal)
            return promise
          },
          [key],
        ),
      { initialProps: { key: 1 } },
    )

    expect(signals[0]?.aborted).toBe(false)
    rerender({ key: 2 })
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  test('ignores late resolve when unmounted before promise resolves', async () => {
    const { promise, resolve } = deferred<number>()
    const { result, unmount } = renderHook(() => useCall(() => promise, []))

    unmount()
    await act(async () => {
      resolve(7)
      await promise
    })
    // No throw / no act warning; final state stays loading (never updated post-unmount).
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

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

  test('coerces a rejection to Error', async () => {
    const { promise, reject } = deferred<{ [Symbol.asyncDispose]: () => Promise<void> }>()
    const { result } = renderHook(() => useAsyncResource(() => promise, []))

    await act(async () => {
      reject('boom')
      await promise.catch(() => {})
    })

    expect(result.current.resource).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('boom')
  })

  test('coerces a synchronous throw to Error', async () => {
    const { result } = renderHook(() =>
      useAsyncResource(() => {
        throw new Error('sync fail')
      }, []),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('sync fail')
    expect(result.current.resource).toBeNull()
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

  test('retains current resource while disposing late-arriving superseded one (active-mount)', async () => {
    const disposeA = vi.fn(async () => {})
    const disposeB = vi.fn(async () => {})
    const resourceA = { [Symbol.asyncDispose]: disposeA }
    const resourceB = { [Symbol.asyncDispose]: disposeB }
    const aDeferred = deferred<typeof resourceA>()
    const bDeferred = deferred<typeof resourceB>()
    let whichDeferred = 0 // 0 for A, 1 for B
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) =>
        useAsyncResource(
          () => (whichDeferred === 0 ? aDeferred.promise : bDeferred.promise),
          [key],
        ),
      { initialProps: { key: 1 } },
    )

    // A is now pending on key: 1
    whichDeferred = 1
    rerender({ key: 2 })
    // B is now pending on key: 2, A is still pending but superseded

    // Resolve B first
    await act(async () => {
      bDeferred.resolve(resourceB)
      await bDeferred.promise
    })
    expect(result.current.resource).toBe(resourceB)
    expect(disposeB).not.toHaveBeenCalled()

    // Now resolve the still-pending A late
    await act(async () => {
      aDeferred.resolve(resourceA)
      await aDeferred.promise
    })

    // A should be disposed since it was superseded
    expect(disposeA).toHaveBeenCalledTimes(1)
    // B should still be current and retained
    expect(result.current.resource).toBe(resourceB)
    expect(disposeB).not.toHaveBeenCalled()
  })

  test('disposes late-arriving resource when unmounted before promise resolves', async () => {
    const dispose = vi.fn(async () => {})
    const resource = { [Symbol.asyncDispose]: dispose }
    const { promise, resolve } = deferred<typeof resource>()
    const { result, unmount } = renderHook(() => useAsyncResource(() => promise, []))

    unmount()
    await act(async () => {
      resolve(resource)
      await promise
    })
    // No throw / no act warning; resource is disposed (late arrival); final state stays loading.
    expect(result.current.resource).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
