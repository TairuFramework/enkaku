import { createReadable } from './readable.js'

/**
 * Create a tuple of `ReadableWritablePair` streams connected to each other.
 */
export function createConnection<AtoB, BtoA = AtoB>(): [
  ReadableWritablePair<BtoA, AtoB>,
  ReadableWritablePair<AtoB, BtoA>,
] {
  const [toA, controllerA] = createReadable<BtoA>()
  const [toB, controllerB] = createReadable<AtoB>()

  const fromA = new WritableStream<AtoB>({
    write(msg) {
      controllerB.enqueue(msg)
    },
    close() {
      controllerB.close()
    },
  })

  const fromB = new WritableStream<BtoA>({
    write(msg) {
      controllerA.enqueue(msg)
    },
    close() {
      controllerA.close()
    },
  })

  return [
    { readable: toA, writable: fromA },
    { readable: toB, writable: fromB },
  ]
}
