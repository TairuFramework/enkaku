export function mapAsync<I, O>(transform: (input: I) => Promise<O>): TransformStream<I, O> {
  return new TransformStream({
    async transform(input, controller): Promise<void> {
      controller.enqueue(await transform(input))
    },
  })
}

export function map<I, O>(transform: (input: I) => O): TransformStream<I, O> {
  return new TransformStream({
    transform(input, controller): void {
      controller.enqueue(transform(input))
    },
  })
}

export function tap<T>(handler: (value: T) => void): TransformStream<T, T> {
  return map((input) => {
    handler(input)
    return input
  })
}
