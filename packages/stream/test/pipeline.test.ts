import { Result } from 'typescript-result'

import {
  combineTransformSteps,
  createPipeline,
  createTransformSink,
  createTransformSource,
  createTransformStep,
} from '../src/index.js'

describe('transformations pipeline', () => {
  test('using transformation functions directly', async () => {
    const source = createTransformSource<string>((input, controller) => {
      if (input.trim() !== '') {
        controller.enqueue(Result.ok(input))
      }
    })
    const transforms = combineTransformSteps<string, number>(
      createTransformStep((value) => Number.parseInt(value, 10)),
      createTransformStep((value) => value + 5),
      createTransformStep((value) => value * 2),
    )
    const sink = createTransformSink<number>((result, controller) => {
      if (result.isOk()) {
        controller.enqueue(result.value)
      } else {
        controller.error(result.error)
      }
    })

    source.readable.pipeThrough(transforms)
    transforms.readable.pipeThrough(sink)

    const writer = source.writable.getWriter()
    await writer.write('5')
    await writer.write(' ')
    await writer.write('15')

    const reader = sink.readable.getReader()
    const first = await reader.read()
    expect(first.value).toEqual(20)
    const second = await reader.read()
    expect(second.value).toEqual(40)
  })

  test('using createPipeline()', async () => {
    const pipeline = createPipeline<string, number>({
      source: (input, controller) => {
        if (input.trim() !== '') {
          controller.enqueue(Result.ok(input))
        }
      },
      steps: [
        createTransformStep<string, number>((value) => Number.parseInt(value, 10)),
        (value: number) => value + 5,
        createTransformStep<number>((value) => value * 2),
      ],
      sink: (result, controller) => {
        if (result.isOk()) {
          controller.enqueue(result.value)
        } else {
          controller.error(result.error)
        }
      },
    })

    const writer = pipeline.writable.getWriter()
    await writer.write('5')
    await writer.write(' ')
    await writer.write('15')

    const reader = pipeline.readable.getReader()
    const first = await reader.read()
    expect(first.value).toEqual(20)
    const second = await reader.read()
    expect(second.value).toEqual(40)
  })
})
