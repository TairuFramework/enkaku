export function createConnection<AtoB, BtoA = AtoB>(): [
  ReadableWritablePair<BtoA, AtoB>,
  ReadableWritablePair<AtoB, BtoA>,
] {
  let controllerA: ReadableStreamDefaultController<BtoA>
  let controllerB: ReadableStreamDefaultController<AtoB>

  const toA = new ReadableStream<BtoA>({
    start(ctrl) {
      controllerA = ctrl
    },
  })

  const toB = new ReadableStream<AtoB>({
    start(ctrl) {
      controllerB = ctrl
    },
  })

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

export function createPipe<T>(): ReadableWritablePair<T, T> {
  let controller: ReadableStreamDefaultController<T>

  const readable = new ReadableStream<T>({
    start(ctrl) {
      controller = ctrl
    },
  })

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
