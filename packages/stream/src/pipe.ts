import { createReadable } from './readable.js'
import { writeTo } from './writable.js'

export type Pipe<T> = ReadableWritablePair<T, T> & {
  drain: (pipePromise: Promise<void>) => Promise<void>
}

/**
 * Create a `ReadableWritablePair` stream queuing written messages until they are read from the other end.
 *
 * The returned `drain` function closes the readable directly (bypassing the
 * writable's writer lock) and waits for the given `pipePromise` to flush all
 * buffered values.
 */
export function createPipe<T>(): Pipe<T> {
  const [readable, controller] = createReadable<T>()

  const writable = writeTo<T>(
    (msg) => {
      controller.enqueue(msg)
    },
    () => {
      controller.close()
    },
  )

  async function drain(pipePromise: Promise<void>): Promise<void> {
    try {
      controller.close()
    } catch {
      // Controller may already be closed
    }
    try {
      await pipePromise
    } catch {
      // Pipe may have errored
    }
  }

  return { readable, writable, drain }
}
