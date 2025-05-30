import { createReadable } from './readable.js'
import { writeTo } from './writable.js'

/**
 * Create a `ReadableWritablePair` stream queuing written messages until they are read from the other end.
 */
export function createPipe<T>(): ReadableWritablePair<T, T> {
  const [readable, controller] = createReadable<T>()

  const writable = writeTo<T>(
    (msg) => {
      controller.enqueue(msg)
    },
    () => {
      controller.close()
    },
  )

  return { readable, writable }
}
