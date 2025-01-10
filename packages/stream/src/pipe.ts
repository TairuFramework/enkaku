import { createReadable } from './readable.js'

/**
 * Create a `ReadableWritablePair` stream queuing written messages until they are read from the other end.
 */
export function createPipe<T>(): ReadableWritablePair<T, T> {
  const [readable, controller] = createReadable<T>()

  const writable = new WritableStream<T>({
    write(msg) {
      controller.enqueue(msg)
    },
    close() {
      controller.close()
    },
  })

  return { readable, writable }
}
