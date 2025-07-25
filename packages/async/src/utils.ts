/**
 * Converts a function returning a value or promise to a Promise.
 */
export function toPromise<T = unknown>(execute: () => T | PromiseLike<T>): Promise<T> {
  return Promise.resolve().then(() => execute())
}

export function raceSignal<T>(promise: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      function onAbort() {
        reject(signal.reason)
      }
      if (signal.aborted) {
        onAbort()
      } else {
        signal.addEventListener('abort', onAbort, { once: true })
        function cleanup() {
          signal.removeEventListener('abort', onAbort)
        }
        promise.then(cleanup, cleanup)
      }
    }),
  ])
}

export async function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay))
}
