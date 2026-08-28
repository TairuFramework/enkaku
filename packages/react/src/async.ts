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
