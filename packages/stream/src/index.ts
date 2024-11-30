/**
 * Web streams utilities for Enkaku transports.
 *
 * ## Installation
 *
 * ```sh
 * npm install @enkaku/stream
 * ```
 *
 * @module stream
 */

import { Result } from 'typescript-result'

/**
 * Create a tuple of [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and associated [ReadableStreamDefaultController](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController).
 */
export function createReadable<T>(): [ReadableStream<T>, ReadableStreamDefaultController<T>] {
  let controller: ReadableStreamDefaultController<T> | undefined
  const stream = new ReadableStream<T>({
    start(ctrl) {
      controller = ctrl
    },
  })
  return [stream, controller as ReadableStreamDefaultController<T>]
}

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

/** @internal */
export function createTransformSource<T>(
  transform?: TransformerTransformCallback<T, Result<T, never>>,
): TransformStream<T, Result<T, never>> {
  return new TransformStream<T, Result<T, never>>({
    transform: transform ?? ((value, controller) => controller.enqueue(Result.ok(value))),
  })
}

/** @internal */
export function createTransformSink<I, O = I, E = unknown>(
  transform: TransformerTransformCallback<Result<I, E>, O>,
): TransformStream<Result<I, E>, O> {
  return new TransformStream<Result<I, E>, O>({ transform })
}

/** @internal */
export type TransformStepStream<I, O = I, E = unknown> = TransformStream<Result<I, E>, Result<O, E>>

/** @internal */
export function createTransformStep<I, O = I, E = unknown>(
  transform: (input: I) => O | Promise<O>,
): TransformStepStream<I, O, E> {
  return new TransformStream({
    transform: async (prev, controller) => {
      const next = await prev.mapCatching(transform)
      controller.enqueue(next as Result<O, E>)
    },
  })
}

export function combineTransformSteps<I, O = I, E = unknown>(
  step: TransformStepStream<I, O, E>,
): TransformStepStream<I, O, E>
export function combineTransformSteps<I, T = I, O = T, E = unknown>(
  step1: TransformStepStream<I, T, E>,
  step2: TransformStepStream<T, O, E>,
): TransformStepStream<I, O, E>
export function combineTransformSteps<I, T1 = I, T2 = T1, O = T2, E = unknown>(
  step1: TransformStepStream<I, T1, E>,
  step2: TransformStepStream<T1, T2, E>,
  step3: TransformStepStream<T2, O, E>,
): TransformStepStream<I, O, E>
export function combineTransformSteps<I, T1 = I, T2 = T1, T3 = T2, O = T3, E = unknown>(
  step1: TransformStepStream<I, T1, E>,
  step2: TransformStepStream<T1, T2, E>,
  step3: TransformStepStream<T2, T3, E>,
  step4: TransformStepStream<T3, O, E>,
): TransformStream<I, Result<O, E>>
export function combineTransformSteps<I, T1 = I, T2 = T1, T3 = T2, T4 = T3, O = T4, E = unknown>(
  step1: TransformStepStream<I, T1, E>,
  step2: TransformStepStream<T1, T2, E>,
  step3: TransformStepStream<T2, T3, E>,
  step4: TransformStepStream<T3, T4, E>,
  step5: TransformStepStream<T4, O, E>,
): TransformStream<I, Result<O, E>>
export function combineTransformSteps<
  I,
  T1 = I,
  T2 = T1,
  T3 = T2,
  T4 = T3,
  T5 = T4,
  O = unknown,
  E = unknown,
>(
  step1: TransformStepStream<I, T1, E>,
  step2: TransformStepStream<T1, T2, E>,
  step3: TransformStepStream<T2, T3, E>,
  step4: TransformStepStream<T3, T4, E>,
  step5: TransformStepStream<T4, T5, E>,
  ...steps: Array<TransformStepStream<unknown>>
): TransformStepStream<I, O, E>
/** @internal */
export function combineTransformSteps(...steps: Array<TransformStepStream<unknown>>) {
  const [first, ...rest] = steps
  let current = first
  for (const step of rest) {
    current.readable.pipeThrough(step)
    current = step
  }
  return { readable: current.readable, writable: first.writable }
}

/** @internal */
export type CreatePipelineParams<I, T = I, O = T, E = unknown> = {
  source?: TransformStream<I, Result<I, never>> | TransformerTransformCallback<I, Result<I, never>>
  // biome-ignore lint/suspicious/noExplicitAny: how to make type-safe?
  steps: Array<TransformStepStream<any, any, E> | ((input: any) => any | Promise<any>)>
  sink: TransformStream<Result<T, E>, O> | TransformerTransformCallback<Result<T, E>, O>
}

/** @internal */
export function createPipeline<I, T = I, O = T, E = unknown>(
  params: CreatePipelineParams<I, T, O, E>,
): ReadableWritablePair<O, I> {
  const source =
    params.source instanceof TransformStream ? params.source : createTransformSource(params.source)
  const steps = params.steps.map((transform) => {
    return transform instanceof TransformStream ? transform : createTransformStep(transform)
  })
  const sink =
    params.sink instanceof TransformStream ? params.sink : createTransformSink(params.sink)

  let current = source as TransformStepStream<unknown>
  for (const step of steps) {
    current.readable.pipeThrough(step)
    current = step
  }
  current.readable.pipeThrough(sink)

  return { readable: sink.readable, writable: source.writable }
}
