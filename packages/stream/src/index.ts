import { toPromise } from '@enkaku/util'

export function createReadable<T>(): [ReadableStream<T>, ReadableStreamDefaultController<T>] {
  let controller: ReadableStreamDefaultController<T> | undefined
  const stream = new ReadableStream<T>({
    start(ctrl) {
      controller = ctrl
    },
  })
  return [stream, controller as ReadableStreamDefaultController<T>]
}

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

export type TransformStepSuccess<T> = { ok: true; value: T }
export type TransformStepFailure<R = unknown> = { ok: false; reason: R }
export type TransformStepResult<T, R = unknown> = TransformStepSuccess<T> | TransformStepFailure<R>

export function toStep<T>(value: T): TransformStepSuccess<T> {
  return { ok: true, value }
}

export function createTransformSource<T>(
  transform?: TransformerTransformCallback<T, TransformStepSuccess<T>>,
): TransformStream<T, TransformStepSuccess<T>> {
  return new TransformStream<T, TransformStepSuccess<T>>({
    transform: transform ?? ((value, controller) => controller.enqueue(toStep(value))),
  })
}

export function createTransformSink<I, O = I, R = unknown>(
  transform: TransformerTransformCallback<TransformStepResult<I, R>, O>,
): TransformStream<TransformStepResult<I, R>, O> {
  return new TransformStream<TransformStepResult<I, R>, O>({ transform })
}

export type TransformStepStream<I, O = I, R = unknown> = TransformStream<
  TransformStepResult<I, R>,
  TransformStepResult<O, R>
>

export function createTransformStep<I, O = I, R = unknown>(
  transform: (input: I) => O | Promise<O>,
): TransformStepStream<I, O, R> {
  return new TransformStream({
    transform: async (prev, controller) => {
      if (prev.ok) {
        try {
          const value = await toPromise(() => transform(prev.value))
          controller.enqueue({ ok: true, value })
        } catch (reason) {
          controller.enqueue({ ok: false, reason: reason as R })
        }
      } else {
        controller.enqueue(prev)
      }
    },
  })
}

export function combineTransformSteps<I, O = I, R = unknown>(
  step: TransformStepStream<I, O, R>,
): TransformStepStream<I, O, R>
export function combineTransformSteps<I, T = I, O = T, R = unknown>(
  step1: TransformStepStream<I, T, R>,
  step2: TransformStepStream<T, O, R>,
): TransformStepStream<I, O, R>
export function combineTransformSteps<I, T1 = I, T2 = T1, O = T2, R = unknown>(
  step1: TransformStepStream<I, T1, R>,
  step2: TransformStepStream<T1, T2, R>,
  step3: TransformStepStream<T2, O, R>,
): TransformStepStream<I, O, R>
export function combineTransformSteps<I, T1 = I, T2 = T1, T3 = T2, O = T3, R = unknown>(
  step1: TransformStepStream<I, T1, R>,
  step2: TransformStepStream<T1, T2, R>,
  step3: TransformStepStream<T2, T3, R>,
  step4: TransformStepStream<T3, O, R>,
): TransformStream<I, TransformStepResult<O, R>>
export function combineTransformSteps<I, T1 = I, T2 = T1, T3 = T2, T4 = T3, O = T4, R = unknown>(
  step1: TransformStepStream<I, T1, R>,
  step2: TransformStepStream<T1, T2, R>,
  step3: TransformStepStream<T2, T3, R>,
  step4: TransformStepStream<T3, T4, R>,
  step5: TransformStepStream<T4, O, R>,
): TransformStream<I, TransformStepResult<O, R>>
export function combineTransformSteps<
  I,
  T1 = I,
  T2 = T1,
  T3 = T2,
  T4 = T3,
  T5 = T4,
  O = unknown,
  R = unknown,
>(
  step1: TransformStepStream<I, T1, R>,
  step2: TransformStepStream<T1, T2, R>,
  step3: TransformStepStream<T2, T3, R>,
  step4: TransformStepStream<T3, T4, R>,
  step5: TransformStepStream<T4, T5, R>,
  ...steps: Array<TransformStepStream<unknown>>
): TransformStepStream<I, O, R>
export function combineTransformSteps(...steps: Array<TransformStepStream<unknown>>) {
  const [first, ...rest] = steps
  let current = first
  for (const step of rest) {
    current.readable.pipeThrough(step)
    current = step
  }
  return { readable: current.readable, writable: first.writable }
}

export type CreatePipelineParams<I, T = I, O = T, R = unknown> = {
  source?:
    | TransformStream<I, TransformStepSuccess<I>>
    | TransformerTransformCallback<I, TransformStepSuccess<I>>
  // biome-ignore lint/suspicious/noExplicitAny: how to make type-safe?
  steps: Array<TransformStepStream<any, any, R> | ((input: any) => any | Promise<any>)>
  sink:
    | TransformStream<TransformStepResult<T, R>, O>
    | TransformerTransformCallback<TransformStepResult<T, R>, O>
}

export function createPipeline<I, T = I, O = T, R = unknown>(
  params: CreatePipelineParams<I, T, O, R>,
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
