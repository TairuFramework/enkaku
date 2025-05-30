export function transform<I, O>(
  callback: TransformerTransformCallback<I, O>,
  flush?: TransformerFlushCallback<O>,
): TransformStream<I, O> {
  return new TransformStream({ transform: callback, flush })
}

export function map<I, O>(handler: (input: I) => O): TransformStream<I, O> {
  return transform((input, controller) => controller.enqueue(handler(input)))
}

export function mapAsync<I, O>(handler: (input: I) => O | PromiseLike<O>): TransformStream<I, O> {
  return transform(async (input, controller) => controller.enqueue(await handler(input)))
}

export function tap<T>(handler: (value: T) => void): TransformStream<T, T> {
  return map((input) => {
    handler(input)
    return input
  })
}
